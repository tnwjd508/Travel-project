"""Backfill the Supabase visitor cache one nationwide month at a time. Dry-run by default."""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv

from .core import ApiError, KntoClient, stamp
from .district import DistrictService, shift_month
from .supabase import SupabaseDatabase
from .tourism_cache import TourismApiStore
from .visitor_store import VisitorMonthStore

ROOT = Path(__file__).resolve().parent.parent


def normalize_month(value):
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', value or ''):
        raise ValueError('월은 YYYY-MM 형식이어야 합니다.')
    return value.replace('-', '')


def month_range(start, end):
    start, end = normalize_month(start), normalize_month(end)
    if start > end:
        raise ValueError('시작 월은 종료 월보다 늦을 수 없습니다.')
    result, current = [], start
    while current <= end and len(result) <= 24:
        result.append(current)
        current = shift_month(current, 1)
    if current <= end or len(result) > 24:
        raise ValueError('한 번에 최대 24개월만 백필할 수 있습니다.')
    return result


async def apply(months, env, delay, transport=None):
    async with httpx.AsyncClient(transport=transport, follow_redirects=False, timeout=12) as http:
        database = SupabaseDatabase(env, http)
        store = VisitorMonthStore(database)
        service = DistrictService(KntoClient(env.get('TOUR_API_SERVICE_KEY', ''), http, TourismApiStore(database)), store)
        completed = []
        try:
            for index, month in enumerate(months):
                existing = await store.get_many('11110', [month])
                if month in existing and existing[month]['complete']:
                    completed.append({'month': month, 'status': 'already_stored'})
                    continue
                values = await service.source_visitor_month(month, persist=False)
                changed = await store.store_month(month, values, stamp())
                completed.append({'month': month, 'status': 'stored', 'rows': changed})
                if delay and index + 1 < len(months):
                    await asyncio.sleep(delay)
        finally:
            await service.close()
        return completed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-month', required=True)
    parser.add_argument('--to-month', required=True)
    parser.add_argument('--delay-seconds', type=float, default=2)
    parser.add_argument('--apply', action='store_true')
    options = parser.parse_args()
    try:
        months = month_range(options.from_month, options.to_month)
        if not 0 <= options.delay_seconds <= 60:
            raise ValueError('호출 간격은 0~60초여야 합니다.')
        if not options.apply:
            print(json.dumps({'mode': 'dry-run', 'months': months, 'count': len(months)}, ensure_ascii=False))
            return
        load_dotenv(ROOT / '.env.local'); load_dotenv(ROOT / '.env')
        result = asyncio.run(apply(months, dict(os.environ), options.delay_seconds))
        print(json.dumps({'mode': 'applied', 'months': result}, ensure_ascii=False))
    except ApiError as error:
        parser.exit(1, error.message + '\n')
    except (ValueError, OSError, httpx.HTTPError):
        parser.exit(1, '방문자 캐시 백필에 실패했습니다. 월 범위·API 호출량·Supabase 설정을 확인하세요.\n')


if __name__ == '__main__':
    main()
