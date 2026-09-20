"""DataLab 기초지자체 일별 방문자(전국)를 월 단위로 받아 data/visitors/YYYYMM.csv.gz로 저장한다.

이미 받은 달은 건너뛰므로 중단 후 다시 실행해도 된다. 한 달 = API 1회(약 2.4만 행).
사용: python scripts/festival-effect/collect_visitors.py [--from 201801] [--to 202608]
"""
import argparse
import calendar
import csv
import gzip
import os
import time

from common import VISITORS, kto_items


def months(start, end):
    y, m = int(start[:4]), int(start[4:])
    while (y, m) <= (int(end[:4]), int(end[4:])):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from', dest='start', default='201801')
    parser.add_argument('--to', dest='end', required=True, help='마지막 월(YYYYMM). DataLab은 약 1개월 늦게 갱신된다.')
    args = parser.parse_args()
    VISITORS.mkdir(parents=True, exist_ok=True)
    for y, m in months(args.start, args.end):
        path = VISITORS / f'{y}{m:02d}.csv.gz'
        if path.exists():
            continue
        last = calendar.monthrange(y, m)[1]
        for attempt in range(4):
            try:
                items = kto_items('DataLabService/locgoRegnVisitrDDList', startYmd=f'{y}{m:02d}01', endYmd=f'{y}{m:02d}{last:02d}')
                break
            except Exception as error:  # 일시 오류는 잠시 후 재시도
                print(f'{y}{m:02d} 재시도 {attempt + 1}: {str(error)[:80]}', flush=True)
                time.sleep(5 * (attempt + 1))
        else:
            print(f'{y}{m:02d} 실패', flush=True)
            continue
        tmp = path.with_suffix('.tmp')
        with gzip.open(tmp, 'wt', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['signguCode', 'signguNm', 'baseYmd', 'touDivCd', 'touNum'])
            for it in items:
                writer.writerow([it['signguCode'], it['signguNm'], it['baseYmd'], it['touDivCd'], it['touNum']])
        os.replace(tmp, path)
        print(f'{y}{m:02d} {len(items)}행', flush=True)
        time.sleep(1)


if __name__ == '__main__':
    main()
