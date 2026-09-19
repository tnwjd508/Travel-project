"""축제 효과 분석 공통: 경로, 인증키, 한국관광공사 API 호출."""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(__file__).resolve().parent / 'data'  # 원본 데이터(용량이 커서 git 제외)
VISITORS = DATA / 'visitors'
SUMMARY_OUT = ROOT / 'src' / 'assets' / 'data' / 'festival-effect.json'  # 화면이 읽는 요약 결과


def service_key():
    key = os.environ.get('TOUR_API_SERVICE_KEY')
    if not key and (ROOT / '.env').exists():
        for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
            if line.startswith('TOUR_API_SERVICE_KEY='):
                key = line.split('=', 1)[1].strip().strip('"')
    if not key:
        raise SystemExit('TOUR_API_SERVICE_KEY가 필요합니다 (.env 또는 환경변수).')
    return urllib.parse.unquote(key)


def kto_items(operation, **params):
    """B551011 API 한 번 호출해 item 목록을 돌려준다. numOfRows를 크게 줘서 페이지 하나로 받는다."""
    query = dict(serviceKey=service_key(), MobileOS='ETC', MobileApp='ONGIL', _type='json', pageNo=1, numOfRows=60000, **params)
    url = f'https://apis.data.go.kr/B551011/{operation}?' + urllib.parse.urlencode(query)
    with urllib.request.urlopen(url, timeout=120) as response:
        payload = json.loads(response.read().decode('utf-8'))
    header, body = payload['response']['header'], payload['response']['body']
    if str(header.get('resultCode')) not in ('0000', '00'):
        raise RuntimeError(f"{operation}: {header.get('resultCode')} {header.get('resultMsg')}")
    items = body['items']['item'] if body.get('items') else []
    items = [items] if isinstance(items, dict) else items
    if int(body['totalCount']) != len(items):
        raise RuntimeError(f'{operation}: 일부만 수신 {len(items)}/{body["totalCount"]}')
    return items
