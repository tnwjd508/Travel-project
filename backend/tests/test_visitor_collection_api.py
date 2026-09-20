import calendar
import json

import httpx
from fastapi.testclient import TestClient

from backend.app import create_app


class VisitorFixture:
    def __init__(self):
        self.months, self.jobs, self.source_calls = {}, {}, 0

    def __call__(self, request):
        if request.url.host == 'apis.data.go.kr':
            self.source_calls += 1
            ym = request.url.params['startYmd'][:6]
            days = calendar.monthrange(int(ym[:4]), int(ym[4:]))[1]
            rows = [dict(signguCode='12210',baseYmd=f'{ym}{day:02}',touDivCd=str(kind),touNum='10')
                for day in range(1,days+1) for kind in range(1,4)]
            return httpx.Response(200,json={'response':{'header':{'resultCode':'0000'},
                'body':{'totalCount':len(rows),'items':{'item':rows}}}})
        path, args = request.url.path, json.loads(request.content or '{}')
        if path.endswith('rpc/tourism_cache_get'):
            return httpx.Response(200,json={'state':'missing'})
        if path.endswith('rpc/tourism_cache_store'):
            return httpx.Response(200,json={'state':'stored','payload':args['p_response_payload'],'fetchedAt':args['p_source_fetched_at']})
        if path.endswith('rpc/visitor_months_get'):
            requested=[value[:7].replace('-','') for value in args['p_months']]
            return httpx.Response(200,json=[self.months[value] for value in requested if value in self.months])
        if path.endswith('rpc/visitor_collection_get'):
            requested=[value[:7].replace('-','') for value in args['p_months']]
            return httpx.Response(200,json=[{'month':value,'state':self.jobs.get(value,'missing'),'attemptCount':0,'retryAfter':None,'errorCode':None} for value in requested])
        if path.endswith('rpc/visitor_collection_claim'):
            ym=args['p_month'][:7].replace('-',''); self.jobs[ym]='generating'
            return httpx.Response(200,json={'state':'claimed','month':ym})
        if path.endswith('rpc/visitor_collection_finish'):
            ym=args['p_month'][:7].replace('-','')
            target=next(row for row in args['p_rows'] if row['district_id']=='12210')
            self.months[ym]=dict(ym=ym,total=target['total_visitors'],local=target['local_visitors'],outside=target['outside_visitors'],foreign=target['foreign_visitors'],
                complete=target['complete'],observedDays=target['observed_days'],expectedDays=target['expected_days'],through=target['through_date'].replace('-',''),sourceFetchedAt=target['source_fetched_at'])
            self.jobs[ym]='completed'
            return httpx.Response(200,json={'state':'completed','month':ym,'storedRows':len(args['p_rows'])})
        if path.endswith('rpc/visitor_collection_fail'):
            return httpx.Response(200,json={'state':'failed'})
        raise AssertionError(path)


def test_public_get_then_collection_post_populates_and_reuses_month():
    fixture=VisitorFixture()
    env={'SUPABASE_URL':'https://database.example','SUPABASE_SECRET_KEY':'sb_secret_test','TOUR_API_SERVICE_KEY':'tour-test'}
    with TestClient(create_app(env,httpx.MockTransport(fixture))) as client:
        query={'regionId':'gwangju','district':'12210','baseYm':'202607','months':'1'}
        before=client.get('/api/district/visitors',params=query)
        assert before.status_code==200 and before.json()['collection']['missingMonths']==['202607','202507']
        collected=client.post('/api/district/visitors/collect',params=query)
        assert collected.status_code==200 and collected.json()['state']=='completed'
        after=client.get('/api/district/visitors',params=query)
        assert after.status_code==200 and after.json()['series'][0]['complete'] is True
        assert after.json()['collection']['missingMonths']==['202507']
        assert fixture.source_calls==1
