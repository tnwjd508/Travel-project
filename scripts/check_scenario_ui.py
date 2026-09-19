"""Browser contract test. HTTP fixtures only; DB/RLS are tested separately with PostgreSQL.

Run against an isolated Vite server with --url. Uses an isolated headless Edge profile.
"""
import argparse
import base64
import json
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5179')
    args = parser.parse_args()
    org_a, org_b, user_id = str(uuid4()), str(uuid4()), str(uuid4())
    stored, keys, submissions = {}, {}, []
    state = {'role': 'editor', 'lose_response': True}
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    jwt = '.'.join([encode({'alg': 'HS256', 'typ': 'JWT'}), encode({'sub': user_id, 'aud': 'authenticated', 'exp': int(time.time()) + 86400}), 'test-signature'])
    user = dict(id=user_id, aud='authenticated', role='authenticated', email='editor@example.test', app_metadata={}, user_metadata={}, created_at='2026-09-19T00:00:00Z')

    def handle(route):
        request = route.request
        parsed = urlsplit(request.url)
        query = parse_qs(parsed.query)
        path = parsed.path
        def respond(payload, status=200):
            route.fulfill(status=status, json=payload, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'})
        if request.method == 'OPTIONS':
            return respond({})
        if path == '/auth/v1/token':
            state['role'] = 'viewer' if request.post_data_json['email'].startswith('viewer') else 'editor'
            return respond(dict(access_token=jwt, refresh_token='test-refresh', token_type='bearer', expires_in=86400, user=user))
        if path == '/auth/v1/user':
            return respond(user)
        if path == '/auth/v1/logout':
            return respond({})
        if path == '/api/account/config':
            return respond({'url': 'https://auth.example.test', 'publishableKey': 'sb_publishable_browser_test'})
        if path == '/api/account/organizations':
            assert request.headers.get('authorization') == 'Bearer ' + jwt
            return respond({'organizations': [{'id': org_a, 'name': '기관 A', 'role': state['role']}, {'id': org_b, 'name': '기관 B', 'role': state['role']}]})
        if path == '/api/scenarios' and request.method == 'POST':
            assert state['role'] == 'editor'
            data = request.post_data_json
            key = request.headers['idempotency-key']
            submissions.append((key, data))
            if key not in keys:
                identifier = str(uuid4())
                stored[identifier] = dict(id=identifier, organization_id=data['organizationId'], created_by=user_id,
                    title='저장 조건 ' + str(len(stored)+1), region_id=data['regionId'], district_id=data['district'], district_name='동구',
                    policy_code=data['policy'], policy_name='야간관광 확대', budget_krw=data['budgetKrw'], start_month=data['startMonth']+'-01',
                    duration_months=data['durationMonths'], briefing_month=data['briefingMonth']+'-01' if data['briefingMonth'] else None,
                    created_at='2026-09-19T12:00:00Z')
                keys[key] = identifier
            if state['lose_response']:
                state['lose_response'] = False
                return respond({'message': '저장 응답 확인 실패. 다시 시도하세요.'}, 503)
            return respond(stored[keys[key]])
        if path == '/api/scenarios':
            return respond({'items': [row for row in stored.values() if row['organization_id'] == query['organizationId'][0]], 'nextCursor': None})
        if path.startswith('/api/scenarios/'):
            row = stored.get(path.split('/')[-1])
            return respond(row) if row and row['organization_id'] == query['organizationId'][0] else respond({'message':'없음'},404)
        if path == '/api/monthly-briefing':
            return respond({'district':'12210','month':'2026-08','storage':{'savedAt':'2026-09-19T00:00:00Z'},'diagnosis':{'summary':'저장된 원본 브리핑 검증 문장'}})
        return respond({'message': '브라우저 검증용 외부 데이터 미제공'}, 503)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        try:
            page = browser.new_page(viewport={'width':1440,'height':1000})
            page.route('**/api/**', handle)
            page.route('**/auth/v1/**', handle)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(args.url + '/dashboard/gwangju/donggu/simulation')
            page.wait_for_load_state('networkidle')
            expect(page.get_by_role('heading',name='기관 공동 저장')).to_be_visible()
            page.get_by_label('이메일',exact=True).fill('editor@example.test')
            page.get_by_label('비밀번호',exact=True).fill('test-only-password')
            page.get_by_role('button',name='기관 계정 로그인').click()
            expect(page.get_by_label('저장 기관')).to_have_value(org_a)
            page.get_by_label('시행 시작월').fill('2026-10')
            page.get_by_label('참고 브리핑 월').fill('2026-08')
            page.get_by_role('button',name='1년',exact=True).click()
            save = page.get_by_role('button',name='현재 조건을 기관에 저장')
            save.click()
            expect(page.get_by_role('alert').filter(has_text='저장 응답 확인 실패')).to_be_visible()
            save.click()
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_be_visible()
            expect(page.get_by_text('저장된 원본 브리핑 검증 문장')).to_be_visible()
            assert len(stored) == 1 and submissions[0][0] == submissions[1][0]
            assert submissions[0][1]['budgetKrw'] == 1500000000 and submissions[0][1]['durationMonths'] == 12
            assert submissions[0][1]['district'] == '12210' and submissions[0][1]['regionId'] == 'jeonnam-gwangju'
            saved_url = page.url
            page.reload()
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_be_visible()
            assert len(submissions) == 2
            page.get_by_role('button',name='이 조건으로 검토').click()
            expect(page.get_by_text('Scenario Review',exact=True)).to_be_visible()
            page.get_by_label('저장 기관').select_option(org_b)
            expect(page.get_by_text('Scenario Review',exact=True)).to_have_count(0)
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_have_count(0)
            page.get_by_label('시행 시작월').fill('2026-11')
            save.click()
            expect(page.get_by_role('heading',name='저장 조건 2',exact=True)).to_be_visible()
            page.go_back(); page.go_back()
            expect(page.get_by_label('저장 기관')).to_have_value(org_a)
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_be_visible()
            page.go_forward(); page.go_forward()
            expect(page.get_by_label('저장 기관')).to_have_value(org_b)
            expect(page.get_by_role('heading',name='저장 조건 2',exact=True)).to_be_visible()
            page.get_by_role('button',name='로그아웃',exact=True).click()
            expect(page.get_by_role('button',name='기관 계정 로그인')).to_be_visible()
            expect(page.get_by_role('heading',name='저장 조건 2',exact=True)).to_have_count(0)
            page.get_by_label('이메일',exact=True).fill('viewer@example.test')
            page.get_by_label('비밀번호',exact=True).fill('test-only-password')
            page.get_by_role('button',name='기관 계정 로그인').click()
            expect(save).to_be_disabled()
            page.goto(saved_url)
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_be_visible()
            page.set_viewport_size({'width':390,'height':844})
            page.get_by_role('heading',name='기관 공동 저장').scroll_into_view_if_needed()
            Path('outputs').mkdir(exist_ok=True)
            page.screenshot(path='outputs/scenario-library-mobile.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            assert not errors, errors
            print('PASS: login, save/retry key, canonical units, stored briefing, reload GET, organization switch, history, logout, viewer, mobile')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
