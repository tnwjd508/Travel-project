import asyncio
import hmac
import math
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException

from .core import ApiError, Budget, Freshness, KntoClient, budget, meta, trace
from .district import TTL, parse_query
from .regions import CATALOGUE

ROOT = Path(__file__).resolve().parent.parent


def create_app(settings=None, transport=None):
    env = dict(os.environ if settings is None else settings)

    @asynccontextmanager
    async def lifespan(app):
        from .district import DistrictService
        from .briefing import BriefingWorker
        async with httpx.AsyncClient(transport=transport, follow_redirects=False, timeout=12) as http:
            app.state.http = http
            app.state.service = DistrictService(KntoClient(env.get('TOUR_API_SERVICE_KEY', ''), http))
            app.state.briefing = BriefingWorker(env)
            try:
                yield
            finally:
                await app.state.briefing.close()
                await app.state.service.close()

    app = FastAPI(title='ON:GIL 관광 데이터 API', version='2.0.0', lifespan=lifespan,
        description='전국 관광 실데이터 API와 광주 대시보드. 지수는 시간·금액·인원 단위가 아닙니다.')

    from .scenarios import scenario_router
    from .evidence import evidence_router
    from .reviews import review_router
    from .readiness import readiness_router
    app.include_router(scenario_router(env))
    app.include_router(evidence_router(env))
    app.include_router(review_router(env))
    app.include_router(readiness_router(env))

    @app.middleware('http')
    async def request_context(request, call_next):
        origin_token = env.get('FASTAPI_PROXY_TOKEN', '')
        if origin_token and request.url.path.startswith('/api/') and request.url.path != '/api/health':
            supplied = request.headers.get('x-ongil-proxy-token', '')
            if not hmac.compare_digest(supplied.encode(), origin_token.encode()):
                return JSONResponse({'code': 'UNAUTHORIZED', 'message': '서버 인증이 필요합니다.'}, status_code=401,
                    headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
        fresh = trace.set(Freshness())
        limit = budget.set(Budget())
        try:
            response = await call_next(request)
            response.headers['X-Content-Type-Options'] = 'nosniff'
            if response.status_code >= 400:
                response.headers['Cache-Control'] = 'no-store'
            return response
        finally:
            trace.reset(fresh)
            budget.reset(limit)

    def error_response(error, ym=None):
        return JSONResponse(dict(meta(ym), code=error.code, message=error.message,
            **({'resultCode': error.result_code} if error.result_code else {})), status_code=error.status,
            headers={'Cache-Control': 'no-store', **({'Allow': 'GET'} if error.status == 405 else {})})

    @app.exception_handler(ApiError)
    async def api_error(request, error):
        return error_response(error, getattr(request.state, 'base_ym', None))

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        if error.status_code == 405 and (request.url.path in ('/api/monthly-briefing', '/api/scenarios')
            or request.url.path.startswith('/api/scenarios/') and request.url.path.endswith('/reviews')):
            return JSONResponse({'code': 'METHOD_NOT_ALLOWED', 'message': 'GET 또는 POST 요청만 지원합니다.'}, status_code=405, headers={'Allow': 'GET, POST', 'Cache-Control': 'no-store'})
        return error_response(ApiError(error.status_code, 'METHOD_NOT_ALLOWED' if error.status_code == 405 else 'NOT_FOUND', 'GET 요청만 지원합니다.' if error.status_code == 405 else '요청한 경로가 없습니다.'))

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        return error_response(ApiError(400, 'INVALID_PARAMETER', '요청 파라미터를 확인하세요.'))

    @app.exception_handler(Exception)
    async def internal_error(request, error):
        return error_response(ApiError(500, 'INTERNAL_ERROR', '관광 데이터 처리 중 오류가 발생했습니다.'))

    @app.get('/api/health', tags=['운영'])
    async def health():
        return {'status': 'ok', 'backend': 'fastapi', 'version': '2.0.0', 'tourApiConfigured': bool(env.get('TOUR_API_SERVICE_KEY', '').strip())}

    @app.get('/api/regions', tags=['지역 목록'])
    async def regions():
        return JSONResponse(CATALOGUE, headers={'Cache-Control': 'no-cache'})

    @app.get('/api/monthly-briefing', tags=['월간 브리핑'], description='월별 저장 결과를 조회합니다. 조회 요청으로 새 브리핑을 생성하지 않습니다.')
    @app.post('/api/monthly-briefing', tags=['월간 브리핑'], description='아직 없는 지역·월의 최초 생성입니다. 저장된 월은 재생성하지 않습니다.')
    async def monthly_briefing(request: Request, district: str = '', month: str | None = None, regionId: str | None = None):
        result = await app.state.briefing.request(request.method, list(request.query_params.multi_items()))
        headers = {'Cache-Control': 'no-store'}
        if result['status'] == 202:
            headers['Retry-After'] = '5'
        if result['status'] == 429:
            headers['Retry-After'] = '30'
        return JSONResponse(result['body'], status_code=result['status'], headers=headers)

    @app.get('/api/district/{resource}', tags=['자치구'], description='summary, visitors, indices, contents, festivals, related, rank, diagnosis, hubs. district는 /api/regions의 시군구 ID 또는 기존 광주 영문 별칭. summary의 all은 광주 5개 구만 의미합니다.')
    async def district_api(request: Request, resource: str, district: str = 'donggu', baseYm: str | None = None,
        visitorYm: str | None = None, months: int | None = None, metric: str | None = None,
        contentTypeId: str | None = None, from_date: str | None = Query(None, alias='from'), regionId: str | None = None):
        query = parse_query(resource, list(request.query_params.multi_items()), env)
        request.state.base_ym = query['baseYm']
        if not env.get('TOUR_API_SERVICE_KEY', '').strip():
            raise ApiError(503, 'MISSING_KEY', 'TOUR_API_SERVICE_KEY 환경변수가 필요합니다.')
        try:
            async with asyncio.timeout(25):
                value = await app.state.service.execute(query)
        except TimeoutError:
            raise ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.') from None
        remaining = max(0, min(TTL[resource], math.floor(trace.get().expires - time.time())))
        return JSONResponse(value, headers={'Cache-Control': f'public, max-age=0, s-maxage={remaining}, must-revalidate'})

    @app.get('/api/tourism', tags=['관광 콘텐츠'])
    async def tourism(request: Request, endpoint: str = 'areaCode2'):
        pairs = list(request.query_params.multi_items())
        if len(pairs) != len(dict(pairs)):
            raise ApiError(400, 'INVALID_PARAMETER', '중복된 파라미터입니다.')
        params = {k: v for k, v in pairs if k != 'endpoint'}
        for key, maximum in [('numOfRows', 1000), ('pageNo', 100)]:
            if key in params and (not params[key].isdigit() or not 1 <= int(params[key]) <= maximum):
                raise ApiError(400, 'INVALID_PARAMETER', '페이지 범위를 확인하세요.')
        items, total = await app.state.service.client.page('KorService2/' + endpoint, params, 3600)
        return {'response': {'header': {'resultCode': '0000', 'resultMsg': 'OK'}, 'body': {'items': {'item': items}, 'totalCount': total, 'pageNo': int(params.get('pageNo', 1)), 'numOfRows': int(params.get('numOfRows', 10))}}}

    @app.get('/api/vworld', tags=['행정동 경계'])
    async def vworld(request: Request, district: str = ''):
        from .vworld import boundary
        if list(request.query_params.keys()) != ['district'] or len(request.query_params.multi_items()) != 1:
            raise ApiError(400, 'INVALID_PARAMETER', 'district만 지정하세요.')
        return await boundary(district, env, app.state.http, app.state.service.cache)

    @app.get('/{path:path}', include_in_schema=False)
    async def frontend(path: str):
        if path == 'api' or path.startswith('api/'):
            raise HTTPException(404)
        dist = (ROOT / 'dist').resolve()
        target = (dist / path).resolve()
        if not target.is_relative_to(dist):
            raise HTTPException(404)
        if target.is_file():
            return FileResponse(target)
        if (dist / 'index.html').is_file():
            return FileResponse(dist / 'index.html', headers={'Cache-Control': 'no-cache'})
        raise ApiError(503, 'FRONTEND_NOT_BUILT', 'React 빌드가 없습니다. npm run build를 실행하세요.')

    return app


app = create_app()
