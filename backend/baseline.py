"""Collect and freeze validated existing district responses; never accept browser result values."""
import asyncio
import json

from .core import ApiError, Budget, Freshness, SOURCE, budget, stamp, trace
from .district import month_days, parse_query
from .evidence import finite, integer, timestamp, ymd


def numeric_or_null(value, minimum=None):
    return value is None or finite(value, minimum) is not None


def validate_response(resource, value, query):
    # Reject non-JSON objects and NaN/Infinity; keep only the genuine sanitized response.
    data = json.loads(json.dumps(value, allow_nan=False))
    if data['district'] != query['district'] or data['baseYm'] != query['baseYm'] or data['source'] != SOURCE:
        raise ValueError('Mismatched baseline')
    timestamp(data['fetchedAt'])
    if not isinstance(data['warnings'], list) or any(not isinstance(w, str) for w in data['warnings']):
        raise ValueError('Invalid metadata')
    if resource == 'summary':
        if data['indexUnit'] != 'index' or data['visitorsMetric'] != 'sum_of_daily_estimated_visitors':
            raise ValueError('Invalid units')
        visitors = data['visitors']
        if visitors['month'] != query['visitorYm'] or visitors['ym'] != query['visitorYm'] or type(visitors['complete']) is not bool:
            raise ValueError('Invalid visitor period')
        expected = month_days(query['visitorYm'])
        if integer(visitors['expectedDays'], 1) != expected or integer(visitors['observedDays']) > expected:
            raise ValueError('Invalid observed days')
        for key in ('total', 'local', 'outside', 'foreign'):
            numeric_or_null(visitors[key], 0)
            if visitors['complete'] and visitors[key] is None:
                raise ValueError('Incomplete complete month')
        if visitors['complete'] and visitors['observedDays'] != expected:
            raise ValueError('Incomplete complete month')
        if visitors['through'] is not None and ymd(visitors['through']).strftime('%Y%m') != query['visitorYm']:
            raise ValueError('Wrong observation month')
        numeric_or_null(visitors['momPct'])
        groups = {'stay': ('ix21','ix2102'), 'spend': ('ix22','ix2201'), 'demand': ('ix11',), 'age': ('ix3102','ix3103','momPct')}
        for group, keys in groups.items():
            for key in keys:
                numeric_or_null(data[group][key])
    else:
        if not isinstance(data['model']['version'], str) or not data['model']['version'] or data['model']['status'] != 'provisional':
            raise ValueError('Invalid diagnosis model')
        expected = {'youth': 'percent', 'stay': 'index', 'concentration': 'percent', 'spend': 'index'}
        issues = data['issues']
        if len(issues) != 4 or {item['id'] for item in issues} != set(expected):
            raise ValueError('Invalid diagnosis issues')
        for item in issues:
            numeric_or_null(item['value'])
            if item['unit'] != expected[item['id']] or item['status'] not in ('unknown','normal','attention'):
                raise ValueError('Invalid diagnosis unit/status')
            if item['value'] is None and item['status'] != 'unknown':
                raise ValueError('Fabricated diagnosis status')
            if not isinstance(item['label'], str) or not isinstance(item['evidence'], str):
                raise ValueError('Invalid diagnosis text')
        if len(data['radar']) != 6 or {item['id'] for item in data['radar']} != {'access','content','spend','stay','awareness','international'}:
            raise ValueError('Invalid diagnosis axes')
        for item in data['radar']:
            numeric_or_null(item['value'])
        numeric_or_null(data['activationIndex'])
        attention = {item['id'] for item in issues if item['status'] == 'attention'}
        if not isinstance(data['priorities'], list) or any(item['issueId'] not in attention for item in data['priorities']):
            raise ValueError('Invalid diagnosis priorities')
    return data


async def capture_baseline(service, env, scenario, base_ym=None, visitor_ym=None):
    pairs = [('district', scenario['district_id']), ('regionId', scenario['region_id'])]
    if base_ym is not None:
        pairs.append(('baseYm', base_ym))
    if visitor_ym is not None:
        pairs.append(('visitorYm', visitor_ym))
    queries = {resource: parse_query(resource, pairs, env) for resource in ('summary', 'diagnosis')}

    async def collect(resource):
        token = trace.set(Freshness())
        try:
            async with asyncio.timeout(24):
                data = await service.execute(queries[resource])
                return validate_response(resource, data, queries[resource])
        except (ApiError, TimeoutError, ValueError, TypeError, KeyError, AttributeError):
            return None
        finally:
            trace.reset(token)

    limit = budget.set(Budget())
    try:
        summary, diagnosis = await asyncio.gather(collect('summary'), collect('diagnosis'))
    finally:
        budget.reset(limit)
    status = 'unavailable' if summary is None and diagnosis is None else 'partial'
    if summary is not None and diagnosis is not None:
        values = [value for group in ('stay','spend','demand','age') for value in summary[group].values()]
        if summary['visitors']['complete'] and all(value is not None for value in values) and all(item['status'] != 'unknown' for item in diagnosis['issues']) and all(item['value'] is not None for item in diagnosis['radar']):
            status = 'complete'
    query = queries['summary']
    return status, dict(request=dict(regionId=scenario['region_id'], districtId=scenario['district_id'],
        indexMonth=query['baseYm'], visitorMonth=query['visitorYm']), capturedAt=stamp(), summary=summary, diagnosis=diagnosis)
