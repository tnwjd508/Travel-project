"""Verify progressive visitor collection UI with browser-local HTTP fixtures."""
import argparse
import json
import time

from playwright.sync_api import expect, sync_playwright


def month(ym, total=None):
    return dict(ym=ym, total=total, local=total, outside=0 if total is not None else None,
        foreign=0 if total is not None else None, complete=total is not None,
        observedDays=31 if total is not None else 0, expectedDays=31,
        through=ym + '31' if total is not None else None)


def response(ready):
    months=[f'2025{value:02}' for value in range(8,13)]+[f'2026{value:02}' for value in range(1,8)]
    series=[month(value, 1000000 if ready and value=='202607' else None) for value in months]
    previous=[month(str(int(value[:4])-1)+value[4:]) for value in months]
    missing=[] if ready else [item['ym'] for item in series+previous]
    return dict(baseYm='202607',source='출처: ⓒ한국관광공사',fetchedAt='2026-09-20T00:00:00Z',warnings=[],
        district='12210',metric='sum_of_daily_estimated_visitors',series=series,previousYear=previous,
        collection=dict(status='ready' if ready else 'missing',missingMonths=missing,activeMonth=None,failedMonths=[]))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5181')
    options=parser.parse_args()
    state={'ready':False,'posts':0}
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='msedge',headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]; page.on('pageerror',lambda error: errors.append(str(error)))
        def route(request_route):
            request=request_route.request
            if '/api/district/visitors/collect?' in request.url:
                state['posts']+=1
                time.sleep(.5)
                state['ready']=True
                request_route.fulfill(status=200,content_type='application/json',body=json.dumps({'state':'completed','month':'202607','storedRows':269}))
            elif '/api/district/visitors?' in request.url:
                request_route.fulfill(status=200,content_type='application/json',body=json.dumps(response(state['ready']),ensure_ascii=False))
            else:
                request_route.continue_()
        page.route('**/api/district/visitors**',route)
        try:
            page.goto(options.url+'/dashboard/gwangju/12210/analytics')
            expect(page.get_by_text('저장되지 않은 방문객 추이를 불러오고 있습니다.',exact=False)).to_be_visible()
            expect(page.get_by_text('2026년 7월')).to_be_visible(timeout=10000)
            assert state['posts']==1,state
            assert not errors,errors
            print('PASS: missing visitor month triggers collection and updates chart')
        finally:
            browser.close()


if __name__=='__main__':
    main()
