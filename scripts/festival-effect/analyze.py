"""축제 개최 효과 추정 (사건연구 + 이중차분).

효과 = 축제 기간 개최 시군구의 방문이 평소보다 얼마나 달랐는가.
  - 평소: 같은 시군구의 2~4주 전 같은 요일 평균 (직전 1주는 사전 홍보 영향을 피하려고 제외)
  - 공통 요인 제거: 같은 시도 안에서 그 기간 축제가 없던 시군구들의 같은 비율(로그)을 평균해 뺀다
  - 위약 검정: 축제가 없는 무작위 날짜에 같은 계산을 해 '우연히' 나오는 분포를 함께 보고한다
결과는 인과 효과의 추정치이며, 축제 기간 방문 변화만 다룬다(소비·재방문·예산 효과는 다루지 않음).

사용: python scripts/festival-effect/analyze.py
출력: src/assets/data/festival-effect.json (화면용 요약), data/festival_effect_full.json (개별 결과 포함)
"""
import csv
import gzip
import json
import math
import random
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from common import DATA, SUMMARY_OUT, VISITORS

GWANGJU = {'12210': '동구', '12240': '서구', '12270': '남구', '12300': '북구', '12330': '광산구'}
NIGHT_WORDS = ('야행', '야간', '밤', '빛', '나이트', '달빛', '불빛')
MAX_DAYS = 7


def is_metro_gu(code):
    """특별·광역시의 자치구(군 제외, 군 코드는 x710 이상). 통합 코드 12는 옛 광주 5개 구만."""
    if code[:2] == '12':
        return code in GWANGJU
    # 서울 송파구(11710), 강동구(11740)는 군 코드 범위와 겹치지만 자치구다.
    if code[:2] == '11':
        return True
    return code[:2] in ('26', '27', '28', '30', '31') and int(code[2:]) < 700


def load_visits():
    """{코드: {YYYYMMDD: {방문자구분: 수}}}. 옛 광주(29)·전남(46) 코드는 같은 이름의 통합 코드(12)로 잇는다."""
    visits, names = defaultdict(dict), {}
    for path in sorted(VISITORS.glob('*.csv.gz')):
        for row in csv.DictReader(gzip.open(path, 'rt', encoding='utf-8')):
            visits[row['signguCode']].setdefault(row['baseYmd'], {})[row['touDivCd']] = float(row['touNum'])
            names[row['signguCode']] = row['signguNm']
    merged = {code: name for code, name in names.items() if code.startswith('12')}
    for old in [c for c in names if c.startswith(('29', '46'))]:
        matches = [c for c, n in merged.items() if n == names[old] and (c in GWANGJU) == old.startswith('29')]
        if len(matches) == 1:
            for day, row in visits.pop(old).items():
                visits[matches[0]].setdefault(day, {}).update(row)
    return visits


def value(visits, code, day, outcome):
    row = visits.get(code, {}).get(day.strftime('%Y%m%d'))
    if not row:
        return None
    if outcome == 'total':
        return sum(row.get(k, 0) for k in ('1', '2', '3')) if '1' in row and '2' in row else None
    return row.get('2')  # 외지인


def log_ratio(visits, code, days, outcome):
    during = [value(visits, code, d, outcome) for d in days]
    usual = [value(visits, code, d - timedelta(weeks=w), outcome) for d in days for w in (2, 3, 4)]
    if any(v is None or v <= 0 for v in during + usual):
        return None
    return math.log(statistics.mean(during) / statistics.mean(usual))


def effect(visits, busy, code, days, outcome):
    treated = log_ratio(visits, code, days, outcome)
    if treated is None:
        return None
    controls = [log_ratio(visits, c, days, outcome) for c in visits
                if c[:2] == code[:2] and c != code and not any(d in busy[c] for d in days)]
    controls = [c for c in controls if c is not None]
    return treated - statistics.mean(controls) if len(controls) >= 3 else None


def summarize(effects, rng):
    effects = [e for e in effects if e is not None]
    if not effects:
        return None
    boot = sorted(statistics.mean(rng.choices(effects, k=len(effects))) for _ in range(2000))
    pct = lambda x: round((math.exp(x) - 1) * 100, 1)
    return dict(n=len(effects), meanPct=pct(statistics.mean(effects)), medianPct=pct(statistics.median(effects)),
                ci95Pct=[pct(boot[50]), pct(boot[1949])], sharePositive=round(sum(e > 0 for e in effects) / len(effects), 2))


def parse(ymd):
    return date(int(ymd[:4]), int(ymd[4:6]), int(ymd[6:8]))


def main():
    rng = random.Random(42)  # 부트스트랩·위약 날짜를 재현 가능하게
    visits = load_visits()
    last_day = max(max(days) for days in visits.values() if days)
    festivals = json.loads((DATA / 'festivals_combined.json').read_text(encoding='utf-8'))
    usable = []
    for f in festivals:
        if f['end'] < f['start']:
            continue
        days = [parse(f['start']) + timedelta(i) for i in range((parse(f['end']) - parse(f['start'])).days + 1)]
        if len(days) > MAX_DAYS or days[-1].strftime('%Y%m%d') > last_day or days[0] < date(2018, 2, 1) or f['code'] not in visits:
            continue
        usable.append((f, days))
    busy = defaultdict(set)
    for f, days in usable:
        busy[f['code']].update(days)

    groups = {}
    for outcome in ('outside', 'total'):
        rows = [(f, days, effect(visits, busy, f['code'], days, outcome)) for f, days in usable]
        placebo = []
        lo, hi = date(2019, 2, 1), parse(last_day)
        for f, days in usable:
            for _ in range(5):
                start = lo + timedelta(rng.randrange((hi - lo).days - len(days)))
                fake = [start + timedelta(i) for i in range(len(days))]
                if not any(d in busy[f['code']] for d in fake):
                    placebo.append(effect(visits, busy, f['code'], fake, outcome))
        groups[outcome] = dict(
            all=summarize([e for _, _, e in rows], rng),
            short=summarize([e for _, d, e in rows if len(d) <= 3], rng),
            long=summarize([e for _, d, e in rows if len(d) >= 4], rng),
            night=summarize([e for f, _, e in rows if any(w in f['title'] for w in NIGHT_WORDS)], rng),
            metroGu=summarize([e for f, _, e in rows if is_metro_gu(f['code'])], rng),
            placebo=summarize(placebo, rng),
        )
        if outcome == 'outside':
            individual = [dict(title=f['title'], code=f['code'], start=f['start'], days=len(d), source=f['source'],
                               effectPct=round((math.exp(e) - 1) * 100, 1)) for f, d, e in rows if e is not None]

    sources = sorted({f['source'] for f in festivals})
    starts = sorted(r['start'] for r in individual)
    summary = dict(
        version=1,
        generatedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'),
        outcome='외지인 일별 방문 추정치 (한국관광공사 DataLab)',
        method='축제 기간 방문을 같은 시군구의 2~4주 전 같은 요일과 비교하고, 같은 시도에서 축제가 없던 시군구의 변화를 뺀 값(이중차분). 95% 구간은 부트스트랩 2,000회.',
        data=dict(visitorsFrom=min(min(d) for d in visits.values() if d), visitorsTo=last_day, festivalsUsed=len(usable),
                  sources=sources, maxDays=MAX_DAYS,
                  festivalStart=dict(first=starts[0], median=starts[len(starts) // 2], last=starts[-1])),
        outside=groups['outside'], total=groups['total'],
        gwangju=sorted([dict(r, district=GWANGJU[r['code']]) for r in individual if r['code'] in GWANGJU], key=lambda r: r['start']),
    )
    SUMMARY_OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (DATA / 'festival_effect_full.json').write_text(json.dumps(dict(summary, individual=individual), ensure_ascii=False, indent=1), encoding='utf-8')
    for name, stat in groups['outside'].items():
        print(f"외지인 {name:8} n={stat['n']:5} 평균 {stat['meanPct']:+.1f}% 95% [{stat['ci95Pct'][0]:+.1f}, {stat['ci95Pct'][1]:+.1f}]")
    print('저장:', SUMMARY_OUT)


if __name__ == '__main__':
    main()
