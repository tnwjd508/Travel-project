"""관광공사 행사(festivals_kto.json) + 전국문화축제표준데이터(CSV)를 현재 시군구 코드로 합친다.

표준데이터에는 시군구 코드가 없어 주소의 시도·시군구 이름으로 방문자 데이터의 코드를 찾는다.
사용: python scripts/festival-effect/merge_festivals.py --standard-csv <전국문화축제표준데이터.csv>
"""
import argparse
import collections
import csv
import gzip
import json
import re
from datetime import date

from common import DATA, VISITORS

# 주소 첫 단어(시도) → 현재 시도 코드. 광주·전남은 2026-07부터 통합 코드 12.
PROVINCE = {'서울': '11', '부산': '26', '대구': '27', '인천': '28', '광주': '12', '대전': '30', '울산': '31', '세종': '36',
            '경기': '41', '충청북': '43', '충북': '43', '충청남': '44', '충남': '44', '전라남': '12', '전남': '12',
            '경상북': '47', '경북': '47', '경상남': '48', '경남': '48', '제주': '50', '강원': '51', '전라북': '52', '전북': '52'}


def current_codes():
    """가장 최근 달 방문자 파일에서 {시도코드: {시군구 이름: 5자리 코드}}를 만든다."""
    latest = sorted(VISITORS.glob('*.csv.gz'))[-1]
    table = collections.defaultdict(dict)
    for row in csv.DictReader(gzip.open(latest, 'rt', encoding='utf-8')):
        table[row['signguCode'][:2]][row['signguNm']] = row['signguCode']
    return table


def code_from_address(address, table):
    words = address.split()
    if len(words) < 2:
        return None
    prefix = next((code for name, code in sorted(PROVINCE.items(), key=lambda kv: -len(kv[0])) if words[0].startswith(name)), None)
    if prefix is None:
        return None
    if prefix == '36':  # 세종은 시군구가 하나
        return next(iter(table['36'].values()), None)
    if len(words) >= 3 and f'{words[1]} {words[2]}' in table[prefix]:  # 예: 수원시 장안구
        return table[prefix][f'{words[1]} {words[2]}']
    return table[prefix].get(words[1])


def _day(value):
    return date(int(value[:4]), int(value[4:6]), int(value[6:8]))


def deduplicate(festivals):
    """같은 시군구에서 시작·종료일이 각각 ±1일 이내면 같은 축제로 본다(관광공사 우선).

    기간이 겹치기만 하는 다른 행사는 지우지 않는다. 예전에는 '겹치면 중복'으로 처리해
    7개월짜리 상설 행사가 그 안의 2일 축제를 지우는 문제가 있었다.
    """
    ordered = sorted(festivals, key=lambda f: (f['source'] != '관광공사', f['code'], f['start']))
    kept, by_code = [], collections.defaultdict(list)
    for f in ordered:
        if any(abs((_day(k['start']) - _day(f['start'])).days) <= 1 and abs((_day(k['end']) - _day(f['end'])).days) <= 1 for k in by_code[f['code']]):
            continue
        kept.append(f)
        by_code[f['code']].append(f)
    return kept


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--standard-csv', help='공공데이터포털 전국문화축제표준데이터 CSV (CP949). 없으면 관광공사 자료만 쓴다.')
    args = parser.parse_args()
    table = current_codes()
    merged, skipped = [], collections.Counter()
    for f in json.loads((DATA / 'festivals_kto.json').read_text(encoding='utf-8')):
        if f.get('progresstype') == '취소' or not f.get('lDongSignguCd'):
            skipped['취소·지역 없음'] += 1
            continue
        merged.append(dict(title=f['title'], start=f['eventstartdate'], end=f['eventenddate'],
                           code=f['lDongRegnCd'] + f['lDongSignguCd'], source='관광공사'))
    if args.standard_csv:
        for row in csv.DictReader(open(args.standard_csv, encoding='cp949')):
            start, end = re.sub(r'\D', '', row['축제시작일자'])[:8], re.sub(r'\D', '', row['축제종료일자'])[:8]
            if len(start) != 8 or len(end) != 8:
                skipped['날짜 형식'] += 1
                continue
            code = code_from_address(row['소재지도로명주소'], table) or code_from_address(row['소재지지번주소'], table)
            if not code:
                skipped['주소→시군구 실패'] += 1
                continue
            merged.append(dict(title=row['축제명'], start=start, end=end, code=code, source='표준데이터'))
    kept = deduplicate(merged)
    skipped['중복'] = len(merged) - len(kept)
    (DATA / 'festivals_combined.json').write_text(json.dumps(kept, ensure_ascii=False), encoding='utf-8')
    print(f'축제 {len(kept)}건', dict(collections.Counter(f['source'] for f in kept)), '제외', dict(skipped))


if __name__ == '__main__':
    main()
