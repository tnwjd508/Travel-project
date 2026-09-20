"""District code migration, source aggregation and the existing public API contract."""
import asyncio
import calendar
import os
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from .core import ApiError, Cache, meta, numeric
from .regions import BY_ID, require_district, region_codes

DISTRICTS = {
    'donggu': ('동구', '12210', '29110', '210'),
    'seogu': ('서구', '12240', '29140', '240'),
    'namgu': ('남구', '12270', '29155', '270'),
    'bukgu': ('북구', '12300', '29170', '300'),
    'gwangsangu': ('광산구', '12330', '29200', '330'),
}
TTL = dict(summary=21600, visitors=86400, indices=86400, contents=3600, festivals=3600, related=86400, rank=86400, diagnosis=21600, hubs=86400)
HUB_LOOKBACK = 4  # 중심 관광지는 매월 8일 갱신이고 통합 코드 전환 중 빈 달이 있어 이전 달까지 거슬러 찾는다.


def shift_month(ym, offset):
    index = int(ym[:4]) * 12 + int(ym[4:]) - 1 + offset
    year, month = divmod(index, 12)
    return f'{year:04}{month + 1:02}'


def month_days(ym):
    return calendar.monthrange(int(ym[:4]), int(ym[4:]))[1]


def valid_month(value):
    return bool(re.fullmatch(r'20\d{2}(0[1-9]|1[0-2])', value))


def change_pct(current, previous):
    return None if current is None or previous in (None, 0) else round((current - previous) / previous * 100, 2)


def children(root, count):
    return [root] + [f'{root}{i:02}' for i in range(1, count + 1)]


GROUPS = {
    'stay': ('AreaTarDemDsService/areaTarSjrnDsList', 'tarSjrnDsIx', children('21', 5)),
    'spend': ('AreaTarDemDsService/areaTarExpDsList', 'tarExpDsIx', children('22', 3)),
    'touristDiversity': ('AreaTarDivService/areaTouDivList', 'touDivIx', children('31', 7)),
    'spendDiversity': ('AreaTarDivService/areaExpDivList', 'expDivIx', children('32', 7)),
    'international': ('AreaTarDivService/areaIntlDivList', 'intlDivIx', children('33', 3)),
    'demand': ('AreaTarResDemService/areaTarSvcDemList', 'tarSvcDemIx', children('11', 12)),
    'culture': ('AreaTarResDemService/areaCulResDemList', 'culResDemIx', children('12', 5)),
}
DIAGNOSTIC_CODES = {'21', '22', '1109', '12', '1101', '1102', '1103', '1104', '33'}


def definition(code):
    for group in GROUPS.values():
        if code in group[2]:
            return group
    raise ApiError(400, 'INVALID_METRIC', '지원하지 않는 지표입니다.')


def parse_query(resource, pairs, env):
    if resource not in TTL:
        raise ApiError(404, 'UNKNOWN_RESOURCE', '지원하지 않는 관광 리소스입니다.')
    allowed = {
        'summary': {'district', 'baseYm', 'visitorYm'}, 'visitors': {'district', 'baseYm', 'months'},
        'indices': {'district', 'baseYm'}, 'contents': {'district', 'contentTypeId'},
        'festivals': {'district', 'from'}, 'related': {'district', 'baseYm'},
        'rank': {'district', 'metric', 'baseYm'}, 'diagnosis': {'district', 'baseYm', 'visitorYm'},
        'hubs': {'district', 'baseYm'},
    }[resource]
    params = dict(pairs)
    if len(params) != len(pairs) or set(params) - (allowed | {'regionId'}):
        raise ApiError(400, 'INVALID_PARAMETER', '알 수 없거나 중복된 파라미터입니다.')
    index_ym = env.get('TOUR_API_INDEX_BASE_YM') or '202608'
    visitor_ym = env.get('TOUR_API_VISITOR_BASE_YM') or '202607'
    if not all(valid_month(v) for v in (index_ym, visitor_ym)):
        raise ApiError(503, 'INVALID_CONFIG', '기준월 환경변수를 확인하세요.')
    district = params.get('district', '' if 'regionId' in params else 'donggu')
    if not (resource == 'summary' and district == 'all' and 'regionId' not in params):
        require_district(district, params.get('regionId'))
    maximum = visitor_ym if resource == 'visitors' else index_ym
    ym = params.get('baseYm', maximum)
    visitor = params.get('visitorYm', min(ym, visitor_ym))
    for value, limit in ((ym, maximum), (visitor, visitor_ym)):
        if not valid_month(value) or not '201901' <= value <= limit:
            raise ApiError(400, 'INVALID_MONTH', '기준월은 YYYYMM 형식의 확인된 데이터 범위여야 합니다.')
    months = params.get('months', '12')
    if not re.fullmatch(r'[1-9]|1[0-2]', months):
        raise ApiError(400, 'INVALID_MONTHS', 'months는 1~12 정수여야 합니다.')
    metric = params.get('metric', '21')
    definition(metric)
    from_date = params.get('from', datetime.now(timezone(timedelta(hours=9))).strftime('%Y%m01'))
    try:
        if not re.fullmatch(r'20\d{6}', from_date):
            raise ValueError()
        datetime.strptime(from_date, '%Y%m%d')
    except ValueError:
        raise ApiError(400, 'INVALID_DATE', 'from은 유효한 YYYYMMDD 날짜여야 합니다.') from None
    content_type = params.get('contentTypeId')
    if content_type is not None and content_type not in ('12', '14', '15', '25', '28', '32', '38', '39'):
        raise ApiError(400, 'INVALID_CONTENT_TYPE', '지원하지 않는 콘텐츠 유형입니다.')
    return dict(resource=resource, district=district, baseYm=ym, visitorYm=visitor, months=int(months), metric=metric, **{'from': from_date}, contentTypeId=content_type)


def sum_visitors(rows, district, ym):
    code = region_codes(district, ym, 'DataLabService')[1]
    seen, days, sums, counts = {}, set(), [0., 0., 0.], [0, 0, 0]
    expected = month_days(ym)
    for row in rows:
        if str(row.get('signguCode')) != code or str(row.get('touDivCd')) not in ('1', '2', '3'):
            continue
        date, div = str(row.get('baseYmd')), int(row['touDivCd']) - 1
        if not re.fullmatch(r'\d{8}', date) or date[:6] != ym or not 1 <= int(date[6:]) <= expected:
            raise ApiError(502, 'INVALID_VISITOR_DATE', '방문자 기준일이 조회 범위와 다릅니다.')
        value = numeric(row.get('touNum'))
        if value is None or value < 0:
            continue
        key = date, div
        if key in seen:
            if seen[key] != value:
                raise ApiError(502, 'DUPLICATE_DATA', '중복 방문자 데이터가 일치하지 않습니다.')
            continue
        seen[key] = value
        days.add(date)
        sums[div] += value
        counts[div] += 1
    complete = all(count == expected for count in counts)
    return dict(ym=ym, total=round(sum(sums), 2) if complete else None,
        **dict(zip(('local', 'outside', 'foreign'), [round(v, 2) if complete else None for v in sums])),
        complete=complete, observedDays=len(days), expectedDays=expected, through=max(days) if days else None)


def distribution(categories):
    return [dict(category=k, count=v, pct=v / len(categories) * 100) for k, v in sorted(Counter(categories).items(), key=lambda item: (-item[1], item[0]))]


def text(value):
    return str(value) if isinstance(value, (str, int, float)) else ''


def image_url(value):
    value = text(value)
    try:
        parsed = urlparse(value)
        return value if parsed.scheme in ('http', 'https') and parsed.netloc else None
    except ValueError:
        return None


TOP_RELATED = 5  # 화면에서 펼쳐 보여주는 연관 장소 수


def related_rows(rows):
    links = {(text(r.get('tAtsCd')), text(r.get('rlteTatsCd'))): r for r in rows if r.get('tAtsCd') and r.get('rlteTatsCd')}
    hubs = {}
    for (code, _), row in links.items():
        hub = hubs.setdefault(code, dict(tAtsCd=code, name=text(row.get('tAtsNm')), relatedCount=0, top=[]))
        hub['relatedCount'] += 1
        rank = numeric(row.get('rlteRank'))
        if rank is not None:
            hub['top'].append(dict(rank=int(rank), name=text(row.get('rlteTatsNm')),
                                   category=text(row.get('rlteCtgrySclsNm')) or None, district=text(row.get('rlteSignguNm')) or None))
    for hub in hubs.values():
        hub['top'] = sorted(hub['top'], key=lambda item: item['rank'])[:TOP_RELATED]
    result = sorted([dict(hub, share=hub['relatedCount'] / len(links) * 100) for hub in hubs.values()], key=lambda h: (-h['relatedCount'], h['tAtsCd']))
    return dict(metric='related_link_share', hubs=result, top3Share=sum(h['share'] for h in result[:3]) if result else None,
        categoryMix=distribution([text(r.get('rlteCtgryMclsNm')) or 'unknown' for r in links.values()]))


class DistrictService:
    def __init__(self, client):
        self.client, self.cache, self.month_cache = client, Cache(), Cache(60)

    async def close(self):
        await self.cache.close()
        await self.month_cache.close()
        await self.client.cache.close()

    async def visitor_month(self, district, ym):
        canonical = require_district(district)['id']
        region_codes(district, ym, 'DataLabService')  # Reject incomparable pre-split periods before fetching.
        async def load():
            rows = await self.client.all('DataLabService/locgoRegnVisitrDDList', dict(startYmd=ym + '01', endYmd=ym + str(month_days(ym))), 0, 30000)
            grouped = {}
            for row in rows:
                grouped.setdefault(str(row.get('signguCode')), []).append(row)
            result = {}
            for code in BY_ID:
                try:
                    source_code = region_codes(code, ym, 'DataLabService')[1]
                except ApiError as error:
                    if error.code == 'UNSUPPORTED_REGION_PERIOD':
                        continue
                    raise
                result[code] = sum_visitors(grouped.get(source_code, []), code, ym)
            return result
        return (await self.month_cache.get(ym, 86400, load))[canonical]

    async def index(self, district, ym, code):
        operation, field, _ = definition(code)
        area, signgu = region_codes(district, ym, operation.split('/')[0])
        rows = await self.client.all(operation, dict(baseYm=ym, areaCd=area, signguCd=signgu, **{field + 'Cd': code}))
        matching = [r for r in rows if str(r.get('baseYm')) == ym and str(r.get('signguCd')) == signgu and str(r.get(field + 'Cd')) == code]
        if len(matching) > 1:
            raise ApiError(502, 'DUPLICATE_INDEX', '지수 응답이 중복되었습니다.')
        return numeric(matching[0].get(field + 'Val')) if matching else None

    async def indices(self, district, ym, selected=None):
        async def group(codes):
            codes = [c for c in codes if selected is None or c in selected]
            return dict(zip(codes, await asyncio.gather(*(self.index(district, ym, c) for c in codes))))
        values = await asyncio.gather(*(group(item[2]) for item in GROUPS.values()))
        warnings = ['일부 지수가 제공되지 않아 null을 반환합니다.'] if any(None in g.values() for g in values) else []
        return dict(meta(ym, warnings), district=district, unit='index', groups=dict(zip(GROUPS, values)))

    async def summary(self, district, ym, visitor_ym):
        current, previous, values, old_age = await asyncio.gather(
            self.visitor_month(district, visitor_ym), self.visitor_month(district, shift_month(visitor_ym, -1)),
            asyncio.gather(*(self.index(district, ym, c) for c in ('21', '2102', '22', '2201', '11', '3102', '3103'))),
            asyncio.gather(*(self.index(district, shift_month(ym, -1), c) for c in ('3102', '3103'))))
        stay, lodging, spend, outside, demand, age20, age30 = values
        age_sum = None if age20 is None or age30 is None else age20 + age30
        old_sum = None if None in old_age else sum(old_age)
        warnings = ['방문자는 일별 추정 방문자 합계이며 월간 순방문자 수가 아닙니다.']
        if not current['complete'] or not previous['complete']:
            warnings.append('방문자 완월 데이터가 부족하여 전월 대비를 계산하지 않았습니다.')
        if None in values or old_sum is None:
            warnings.append('일부 지수가 제공되지 않아 null을 반환합니다.')
        return dict(meta(ym, warnings), district=district,
            visitors=dict(current, month=visitor_ym, momPct=change_pct(current['total'], previous['total']) if current['complete'] and previous['complete'] else None),
            stay=dict(ix21=stay, ix2102=lodging), spend=dict(ix22=spend, ix2201=outside), demand=dict(ix11=demand),
            age=dict(ix3102=age20, ix3103=age30, momPct=change_pct(age_sum, old_sum)), indexUnit='index', visitorsMetric='sum_of_daily_estimated_visitors')

    async def contents(self, district, ym, content_type):
        area, signgu = region_codes(district, ym, 'KorService2')
        params = dict(lDongRegnCd=area, lDongSignguCd=signgu, arrange='O')
        if content_type:
            params['contentTypeId'] = content_type
        rows = await self.client.all('KorService2/areaBasedList2', params, 3600)
        unique = {text(r['contentid']): r for r in rows if r.get('contentid')}
        items = []
        for code, row in unique.items():
            lng, lat = numeric(row.get('mapx')), numeric(row.get('mapy'))
            valid = lng is not None and lat is not None and -180 <= lng <= 180 and -90 <= lat <= 90 and (lng or lat)
            items.append(dict(contentId=code, title=text(row.get('title')), lng=lng if valid else None, lat=lat if valid else None,
                category=text(row.get('lclsSystm1')) or 'unknown', image=image_url(row.get('firstimage')),
                addr=' '.join(text(row.get(k)) for k in ('addr1', 'addr2') if row.get(k)), copyrightType=text(row.get('cpyrhtDivCd')) or None))
        return dict(meta(ym), district=district, items=items, totalCount=len(items), typeShare=distribution([i['category'] for i in items]), distributionBasis='content_count', temporalBasis='fetchedAt')

    async def festivals(self, district, ym, from_date):
        area, signgu = region_codes(district, ym, 'KorService2')
        rows = await self.client.all('KorService2/searchFestival2', dict(lDongRegnCd=area, lDongSignguCd=signgu, eventStartDate=from_date, arrange='A'), 3600)
        unique = {text(r['contentid']): r for r in rows if r.get('contentid')}
        items = [dict(contentId=code, title=text(r.get('title')), start=text(r.get('eventstartdate')), end=text(r.get('eventenddate')), place=text(r.get('addr1')), image=image_url(r.get('firstimage'))) for code, r in unique.items()]
        return dict(meta(ym), district=district, items=sorted(items, key=lambda i: i['start']), temporalBasis='event_dates', **{'from': from_date})

    async def related(self, district, ym):
        area, signgu = region_codes(district, ym, 'TarRlteTarService1')
        rows = await self.client.all('TarRlteTarService1/areaBasedList1', dict(baseYm=ym, areaCd=area, signguCd=signgu))
        return dict(meta(ym, ['연관 관광지 연결 건수의 구성비이며 방문객 집중률이 아닙니다.']), district=district,
            **related_rows([r for r in rows if str(r.get('baseYm')) == ym and str(r.get('signguCd')) == signgu]))

    async def hubs(self, district, ym):
        """기초지자체 중심 관광지 순위. 연결 중심성 순위이며 방문객 수 순위가 아니다."""
        warning = '중심 관광지 순위는 다른 관광지와의 연결 건수를 기준으로 한 순위이며 방문객 수 순위가 아닙니다.'
        for offset in range(HUB_LOOKBACK):
            month = shift_month(ym, -offset)
            area, signgu = region_codes(district, month, 'LocgoHubTarService1')
            rows = [r for r in await self.client.all('LocgoHubTarService1/areaBasedList1', dict(baseYm=month, areaCd=area, signguCd=signgu))
                    if str(r.get('signguCd')) == signgu and str(r.get('baseYm')) == month]
            if not rows:
                continue
            items = sorted((dict(rank=int(numeric(r.get('hubRank')) or 0), name=text(r.get('hubTatsNm')), category=text(r.get('hubCtgryMclsNm')) or None,
                                 lng=numeric(r.get('mapX')), lat=numeric(r.get('mapY'))) for r in rows if numeric(r.get('hubRank'))), key=lambda i: i['rank'])
            extra = [] if month == ym else [f'{ym[:4]}년 {ym[4:]}월 중심 관광지 자료가 없어 {month[:4]}년 {month[4:]}월 자료를 표시합니다.']
            return dict(meta(month, [warning] + extra), district=district, metric='hub_link_centrality_rank', items=items, totalCount=len(items))
        return dict(meta(ym, [warning, '최근 4개월 동안 중심 관광지 자료가 제공되지 않았습니다.']), district=district,
                    metric='hub_link_centrality_rank', items=[], totalCount=0)

    async def rank(self, district, ym, code):
        operation, field, _ = definition(code)
        merged = ym >= ('202608' if operation.startswith('AreaTarResDemService/') else '202607')
        areas = ['11', '26', '27', '28', '30', '31', '36', '41', '43', '44', '47', '48', '50', '51', '52'] + (['12'] if merged else ['29', '46'])
        batches = await asyncio.gather(*(self.client.all(operation, dict(baseYm=ym, areaCd=area, **{field + 'Cd': code})) for area in areas))
        values, missing_districts, missing_areas = {}, set(), []
        for area, rows in zip(areas, batches):
            valid_in_area = False
            for row in rows:
                signgu = str(row.get('signguCd', ''))
                if not re.fullmatch(r'\d{5}', signgu) or str(row.get('baseYm')) != ym or str(row.get(field + 'Cd')) != code:
                    continue
                value = numeric(row.get(field + 'Val'))
                if value is None:
                    missing_districts.add(signgu)
                else:
                    valid_in_area = True
                    if signgu in values and values[signgu] != value:
                        raise ApiError(502, 'DUPLICATE_INDEX', '전국 순위 지수가 중복되었습니다.')
                    values[signgu] = value
            if not valid_in_area:
                missing_areas.append(area)
        target = region_codes(district, ym, operation.split('/')[0])[1]
        complete = not missing_areas and not missing_districts and target in values
        rank = 1 + sum(v > values[target] for v in values.values()) if complete else None
        total = len(values)
        warnings = ['전국 관측 시군구 내 순위이며 행정구역 모집단 전체와 대조하지 않았습니다.']
        if not complete:
            warnings.append('전국 비교 데이터가 부족하여 순위를 표시하지 않습니다.')
        return dict(meta(ym, warnings), district=district, metric=code, rank=rank, total=total,
            percentile=(100 if total == 1 else (total - rank) / (total - 1) * 100) if complete else None,
            topPct=rank / total * 100 if complete else None, complete=complete,
            missingAreas=missing_areas, missingDistricts=sorted(missing_districts), scope='observed_nationwide_districts', populationVerified=False)

    async def execute(self, query):
        async def load():
            resource, district, ym = query['resource'], query['district'], query['baseYm']
            if resource == 'summary':
                if district == 'all':
                    items = await asyncio.gather(*(self.summary(slug, ym, query['visitorYm']) for slug in DISTRICTS))
                    return dict(meta(ym, dict.fromkeys(w for item in items for w in item['warnings'])), items=items)
                return await self.summary(district, ym, query['visitorYm'])
            if resource == 'indices':
                return await self.indices(district, ym)
            if resource == 'contents':
                return await self.contents(district, ym, query['contentTypeId'])
            if resource == 'festivals':
                return await self.festivals(district, ym, query['from'])
            if resource == 'related':
                return await self.related(district, ym)
            if resource == 'hubs':
                return await self.hubs(district, ym)
            if resource == 'rank':
                return await self.rank(district, ym, query['metric'])
            if resource == 'visitors':
                months = [shift_month(ym, i - query['months'] + 1) for i in range(query['months'])]
                series, previous = await asyncio.gather(
                    asyncio.gather(*(self.visitor_month(district, m) for m in months)),
                    asyncio.gather(*(self.visitor_month(district, shift_month(m, -12)) for m in months)))
                warnings = ['방문자는 일별 추정치 합계입니다.']
                if any(not m['complete'] for m in series + previous):
                    warnings.append('일부 월은 데이터가 부족합니다. complete 필드를 확인하세요.')
                return dict(meta(ym, warnings), district=district, metric='sum_of_daily_estimated_visitors', series=series, previousYear=previous)
            if resource == 'diagnosis':
                from .diagnosis import diagnose
                summary, indices, related = await asyncio.gather(self.summary(district, ym, query['visitorYm']), self.indices(district, ym, DIAGNOSTIC_CODES), self.related(district, ym))
                return diagnose(summary, indices, related)
            raise ApiError(404, 'UNKNOWN_RESOURCE', '지원하지 않는 리소스입니다.')
        return await self.cache.get(tuple(sorted(query.items())), TTL[query['resource']], load)
