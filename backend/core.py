"""Bounded, asynchronous upstream access. No credentials or upstream bodies in errors."""
import asyncio
import contextvars
import json
import math
import re
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import unquote

import httpx

SOURCE = '출처: ⓒ한국관광공사'


class ApiError(Exception):
    def __init__(self, status, code, message, result_code=None):
        super().__init__(message)
        self.status, self.code, self.message, self.result_code = status, code, message, result_code


@dataclass
class Freshness:
    fetched: float = field(default_factory=time.time)
    expires: float = math.inf


@dataclass
class Budget:
    calls: int = 0
    maximum: int = 80
    deadline: float = field(default_factory=lambda: time.monotonic() + 25)


trace = contextvars.ContextVar('freshness', default=None)
budget = contextvars.ContextVar('budget', default=None)


def stamp(timestamp=None):
    return datetime.fromtimestamp(timestamp if timestamp is not None else time.time(), timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def meta(ym, warnings=()):
    current = trace.get()
    return dict(baseYm=ym, source=SOURCE, fetchedAt=stamp(current.fetched if current else None), warnings=list(warnings))


def observe(fresh):
    parent = trace.get()
    if parent:
        parent.fetched = min(parent.fetched, fresh.fetched)
        parent.expires = min(parent.expires, fresh.expires)


def observe_source(fetched_at, ttl=3600):
    """Propagate persisted source freshness without treating a DB read as a fresh upstream fetch."""
    try:
        parsed = datetime.fromisoformat(fetched_at.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError()
        timestamp = parsed.timestamp()
    except (ValueError, TypeError, AttributeError, OverflowError):
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 수집 시각을 확인하지 못했습니다.') from None
    observe(Freshness(fetched=timestamp, expires=time.time() + max(0, min(ttl, 86400))))


class Cache:
    def __init__(self, capacity=256):
        self.capacity, self.values, self.pending = capacity, OrderedDict(), {}

    async def get(self, key, ttl, load, timeout=25):
        found = self.values.get(key)
        if found and found[1].expires > time.time():
            self.values.move_to_end(key)
            observe(found[1])
            return found[0]
        self.values.pop(key, None)
        task = self.pending.get(key)
        if task is None:
            if len(self.pending) >= self.capacity:
                raise ApiError(503, 'BUSY', '요청이 많습니다. 잠시 후 다시 시도하세요.')

            async def run():
                fresh = Freshness(expires=time.time() + min(ttl or 86400, 86400))
                token = trace.set(fresh)
                try:
                    async with asyncio.timeout(timeout):
                        value = await load()
                    if ttl:
                        self.values[key] = (value, fresh)
                        while len(self.values) > self.capacity:
                            self.values.popitem(last=False)
                    return value, fresh
                except TimeoutError:
                    raise ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.') from None
                finally:
                    trace.reset(token)

            task = asyncio.create_task(run())
            self.pending[key] = task

            def done(completed):
                self.pending.pop(key, None)
                if not completed.cancelled():
                    completed.exception()  # Consume failures even if every waiter disconnected.

            task.add_done_callback(done)
        value, fresh = await asyncio.shield(task)
        observe(fresh)
        return value

    async def close(self):
        tasks = list(self.pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self.values.clear()


def numeric(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)) or (isinstance(value, str) and not value.strip()):
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, OverflowError):
        return None


def parse_envelope(text):
    try:
        payload = json.loads(text)
    except (ValueError, TypeError):
        code = re.search(r'<(?:returnReasonCode|resultCode)>\s*([A-Za-z0-9_-]{1,16})\s*<', text)
        raise ApiError(502, 'UPSTREAM_ERROR', '관광 API가 정상 데이터를 반환하지 않았습니다.', code[1] if code else None) from None
    gateway = payload.get('OpenAPI_ServiceResponse', {}).get('cmmMsgHeader', {}) if isinstance(payload, dict) else {}
    gateway_code = str(gateway.get('returnReasonCode', '')) if isinstance(gateway, dict) else ''
    if re.fullmatch(r'\d{2}', gateway_code):
        if gateway_code in ('22', '23'):
            raise ApiError(503, 'UPSTREAM_RATE_LIMIT', '관광 API 호출 한도에 도달했습니다.', gateway_code)
        if gateway_code in ('20', '30', '31'):
            raise ApiError(503, 'UPSTREAM_AUTH', '관광 API 이용 권한 또는 인증키를 확인하세요.', gateway_code)
        raise ApiError(502, 'UPSTREAM_ERROR', '관광 API 요청이 실패했습니다.', gateway_code)
    response = payload.get('response', {}) if isinstance(payload, dict) else {}
    header = response.get('header', {}) if isinstance(response, dict) else {}
    code = str(header.get('resultCode', '')) if isinstance(header, dict) else ''
    if code not in ('0000', '00'):
        raise ApiError(502, 'UPSTREAM_ERROR', '관광 API 요청이 실패했습니다.', code if re.fullmatch(r'[A-Za-z0-9_-]{1,16}', code) else None)
    body = response.get('body')
    total = numeric(body.get('totalCount')) if isinstance(body, dict) else None
    if total is None or total < 0 or not total.is_integer():
        raise ApiError(502, 'INVALID_UPSTREAM', '관광 API 응답 형식이 올바르지 않습니다.')
    raw = body.get('items')
    raw = raw.get('item') if isinstance(raw, dict) else None
    items = [] if raw is None or raw == '' else raw if isinstance(raw, list) else [raw]
    if any(not isinstance(row, dict) for row in items) or (total > 0 and not items):
        raise ApiError(502, 'INVALID_UPSTREAM', '관광 API 응답 형식이 올바르지 않습니다.')
    return items, int(total)


OPERATIONS = {
    'DataLabService/locgoRegnVisitrDDList': {'startYmd', 'endYmd'},
    'TarRlteTarService1/areaBasedList1': {'baseYm', 'areaCd', 'signguCd'},
    'LocgoHubTarService1/areaBasedList1': {'baseYm', 'areaCd', 'signguCd'},
}
for service, operation, name in [
    ('AreaTarDemDsService', 'areaTarSjrnDsList', 'tarSjrnDsIx'),
    ('AreaTarDemDsService', 'areaTarExpDsList', 'tarExpDsIx'),
    ('AreaTarDivService', 'areaTouDivList', 'touDivIx'),
    ('AreaTarDivService', 'areaExpDivList', 'expDivIx'),
    ('AreaTarDivService', 'areaIntlDivList', 'intlDivIx'),
    ('AreaTarResDemService', 'areaTarSvcDemList', 'tarSvcDemIx'),
    ('AreaTarResDemService', 'areaCulResDemList', 'culResDemIx'),
]:
    OPERATIONS[f'{service}/{operation}'] = {'baseYm', 'areaCd', 'signguCd', name + 'Cd'}

TOUR_PARAMETERS = set('numOfRows pageNo arrange contentTypeId areaCode sigunguCode cat1 cat2 cat3 mapX mapY radius keyword eventStartDate eventEndDate contentId defaultYN firstImageYN areacodeYN catcodeYN addrinfoYN mapinfoYN overviewYN imageYN subContentId lDongRegnCd lDongSignguCd lDongListYn modifiedtime showflag'.split())
for operation in 'areaCode2 areaBasedList2 locationBasedList2 searchKeyword2 searchFestival2 searchStay2 detailCommon2 detailIntro2 detailInfo2 detailImage2 ldongCode2'.split():
    OPERATIONS[f'KorService2/{operation}'] = TOUR_PARAMETERS


class KntoClient:
    def __init__(self, key, http, store=None):
        self.key, self.http, self.store = unquote(key.strip()), http, store
        self.cache = Cache(512)
        self.semaphore = asyncio.Semaphore(6)
        self.usage = {}

    async def page(self, operation, params, ttl=86400):
        if operation not in OPERATIONS:
            raise ApiError(400, 'INVALID_OPERATION', '지원하지 않는 API입니다.')
        if set(params) - (OPERATIONS[operation] | {'pageNo', 'numOfRows'}):
            raise ApiError(400, 'INVALID_PARAMETER', '허용되지 않는 파라미터입니다.')
        async def load():
            cached = None
            if self.store:
                try:
                    cached = await self.store.get(operation, dict(sorted((key, str(value)) for key, value in params.items())))
                except ApiError:
                    cached = None
            if cached and ttl and cached['age'] <= ttl:
                observe_source(cached['fetchedAt'], max(0, ttl - cached['age']))
                return cached['items'], cached['total']

            async def upstream():
                if not self.key:
                    raise ApiError(503, 'MISSING_KEY', 'TOUR_API_SERVICE_KEY 환경변수가 필요합니다.')
                context = budget.get() or Budget()
                remaining = context.deadline - time.monotonic()
                if remaining <= 0:
                    raise ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.')
                try:
                    async with asyncio.timeout(remaining):
                        async with self.semaphore:
                            if context.calls >= context.maximum:
                                raise ApiError(503, 'REQUEST_BUDGET', '요청별 API 호출 한도에 도달했습니다.')
                            day = datetime.now(timezone.utc).date().isoformat()
                            used_day, count = self.usage.get(operation, (day, 0))
                            count = count if day == used_day else 0
                            if count >= 900:
                                raise ApiError(503, 'DAILY_BUDGET', '외부 API 일일 호출 예산에 도달했습니다.')
                            context.calls += 1
                            self.usage[operation] = (day, count + 1)
                            response = await self.http.get('https://apis.data.go.kr/B551011/' + operation,
                                params=dict(serviceKey=self.key, MobileOS='ETC', MobileApp='ONGIL', _type='json', **params),
                                timeout=12, follow_redirects=False)
                            result = parse_envelope(response.text)
                            if not response.is_success:
                                raise ApiError(502, 'UPSTREAM_HTTP', '관광 API 서버 요청이 실패했습니다.')
                            return result
                except TimeoutError:
                    raise ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.') from None
                except httpx.HTTPError:
                    raise ApiError(502, 'UPSTREAM_UNAVAILABLE', '관광 API 연결 실패 또는 응답 시간 초과입니다.') from None

            try:
                result = await upstream()
            except ApiError:
                if not cached:
                    raise
                observe_source(cached['fetchedAt'], 300)
                return cached['items'], cached['total']
            if self.store:
                try:
                    await self.store.store(operation, dict(sorted((key, str(value)) for key, value in params.items())),
                        result[0], result[1], stamp())
                except ApiError:
                    pass
            return result

        return await self.cache.get((operation, tuple(sorted(params.items()))), ttl, load)

    async def all(self, operation, params, ttl=86400, page_size=1000):
        rows, expected = [], None
        for page in range(1, 101):
            items, total = await self.page(operation, dict(params, pageNo=str(page), numOfRows=str(page_size)), ttl)
            if expected is not None and expected != total:
                raise ApiError(502, 'DATA_CHANGED', '조회 중 데이터가 변경되었습니다.')
            expected = total
            rows.extend(items)
            if len(rows) == total:
                return rows
            if not items or len(rows) > total:
                break
        raise ApiError(502, 'PAGE_LIMIT', '전체 데이터를 수집하지 못했습니다.')
