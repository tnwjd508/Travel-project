"""Read-only readiness check; no generation or database mutations."""
import asyncio
import shutil
from pathlib import Path

from fastapi import APIRouter, Request

from .core import ApiError
from .evidence import EvidenceService
from .reviews import review_contract
from .supabase import SupabaseDatabase, json_response

ROOT = Path(__file__).resolve().parent.parent


def readiness_router(env):
    router = APIRouter(tags=['운영'])

    @router.get('/api/ready')
    async def ready(request: Request):
        checks = dict(database=False, analysisImported=False,
            tourApiConfigured=bool(env.get('TOUR_API_SERVICE_KEY', '').strip()),
            briefingModelConfigured=bool(env.get('GEMINI_API_KEY', '').strip()),
            briefingRuntimeAvailable=bool(shutil.which(env.get('NODE_EXECUTABLE') or 'node'))
                and (ROOT / 'node_modules/tsx/package.json').is_file() and (ROOT / 'server/briefing/bridge.ts').is_file())
        try:
            async with asyncio.timeout(20):
                db = SupabaseDatabase(env, request.app.state.http)
                db.config()
                await review_contract(db)
                for table in ('organizations', 'organization_members', 'scenario_reviews', 'policy_evidence_statistics'):
                    await db.rows(table, params={'select': '*', 'limit': '0'}, service=True)
                # Briefing tables intentionally deny even service-role SELECT; use their read RPC.
                await db.call('POST', '/rest/v1/rpc/briefing_get', payload={
                    'p_region_id': 'jeonnam-gwangju', 'p_district_id': '12210', 'p_month': '2000-01-01'}, service=True)
                await db.call('POST', '/rest/v1/rpc/visitor_months_get', payload={
                    'p_region_id': 'jeonnam-gwangju', 'p_district_id': '12210', 'p_months': ['2000-01-01']}, service=True)
                await db.call('POST', '/rest/v1/rpc/visitor_collection_get', payload={
                    'p_months': ['2000-01-01']}, service=True)
                await db.call('POST', '/rest/v1/rpc/tourism_cache_get', payload={
                    'p_request_sha256': '0' * 64, 'p_operation': 'KorService2/areaCode2',
                    'p_request_params': {}, 'p_schema_version': 1}, service=True)
                checks['analysisImported'] = await EvidenceService(db).release() is not None
                checks['database'] = True
        except (ApiError, TimeoutError):
            pass
        is_ready = all(checks.values())
        return json_response({'status': 'ready' if is_ready else 'not_ready', 'checks': checks}, 200 if is_ready else 503)

    return router
