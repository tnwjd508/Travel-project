"""Browser contract test. HTTP fixtures only; DB/RLS are tested separately with PostgreSQL.

Run against an isolated Vite server with --url. Uses an isolated headless Edge profile.
"""
import argparse
import base64
import copy
import sys
import json
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.tests.test_reviews import DatabaseFixture, ENV, save as save_fixture
from backend.tests.test_evidence import stat_row, release_row
from backend.evidence import EvidenceService, selection, empty_reference


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5179')
    args = parser.parse_args()
    org_a, org_b, user_id = str(uuid4()), str(uuid4()), str(uuid4())
    stored, keys, submissions = {}, {}, []
    state = {'role': 'editor', 'lose_response': True, 'lose_review_response': True, 'latest': str(uuid4())}
    reviews, review_keys, review_submissions, district_reads = {}, {}, [], []
    with TestClient(create_app(ENV, httpx.MockTransport(DatabaseFixture()))) as fixture_client:
        result = save_fixture(fixture_client)
        assert result.status_code == 200, result.text
        baseline = result.json()['review']['baseline_snapshot']
    def reference(policy, district_id, release_id):
        district, segment, unavailable = selection(policy, district_id)
        if unavailable: return empty_reference(policy, district, unavailable)
        row=stat_row(segment, release=release_id)
        return EvidenceService(None).present(policy, district, release_row(release_id), row)

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
        if path == '/api/policy-evidence':
            release_id=query.get('releaseId',[state['latest']])[0]
            items=[reference(policy,query['district'][0],release_id) for policy in ['night','festival','shuttle','market','art']]
            return respond(dict(districtId=items[0]['districtId'],regionId=items[0]['regionId'],releaseId=release_id,items=items))
        if path.startswith('/api/district/'):
            district_reads.append(path)
            resource=path.rsplit('/',1)[-1]
            if resource in ('summary','diagnosis'):
                data=copy.deepcopy(baseline[resource])
                data['district']=query.get('district',['12210'])[0]
                if resource=='summary': data['stay']['ix21']=999
                return respond(data)
        if path.startswith('/api/scenario-reviews/'):
            data=reviews.get(path.rsplit('/',1)[-1])
            return respond(data) if data and data['review']['organization_id']==query['organizationId'][0] else respond({'message':'검토 없음'},404)
        if path.startswith('/api/scenarios/') and path.endswith('/reviews'):
            scenario_id=path.split('/')[-2]
            scenario=stored[scenario_id]
            if request.method=='GET':
                return respond({'items':[item['review'] for item in reviews.values() if item['scenario']['id']==scenario_id], 'nextCursor':None})
            assert state['role']=='editor'
            key=request.headers['idempotency-key']; review_submissions.append(key)
            assert request.post_data_json=={'organizationId':scenario['organization_id']}
            if key not in review_keys:
                identifier=str(uuid4()); evidence=reference(scenario['policy_code'],scenario['district_id'],state['latest'])
                review=dict(id=identifier,organization_id=scenario['organization_id'],scenario_id=scenario_id,created_by=user_id,
                    evidence_statistic_id=evidence['statisticId'],reference_status=evidence['status'],review_kind='historical_reference',
                    selection_rule_version='festival-reference-v2',baseline_schema_version=1,baseline_status='complete',
                    baseline_snapshot=copy.deepcopy(baseline),created_at='2026-09-20T00:00:00Z')
                reviews[identifier]=dict(review=review,scenario=scenario,evidence=evidence); review_keys[key]=identifier
            if state['lose_review_response']:
                state['lose_review_response']=False
                return respond({'message':'검토 응답 확인 실패. 같은 요청으로 다시 시도하세요.'},503)
            return respond(reviews[review_keys[key]])
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
            return respond({'items': [row for row in stored.values() if row['organization_id'] == query['organizationId'][0]
                and row['district_id'] == query.get('district', [row['district_id']])[0]], 'nextCursor': None})
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
            page.get_by_role('combobox').first.click()
            page.get_by_role('option',name='문화축제 개최',exact=True).click()
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
            page.get_by_role('button',name='조건 불러오기').click()
            expect(page.get_by_text('Scenario Review',exact=True)).to_be_visible()
            page.get_by_role('button',name='현재 자료로 검토 저장',exact=True).click()
            expect(page.get_by_role('alert').filter(has_text='검토 응답 확인 실패')).to_be_visible()
            page.get_by_role('button',name='같은 요청으로 저장 재시도',exact=True).click()
            expect(page).to_have_url(re.compile('review='))
            expect(page.get_by_text('+1.7%',exact=True)).to_be_visible()
            assert len(reviews)==1 and review_submissions[0]==review_submissions[1]
            review_url=page.url; old_release=next(iter(reviews.values()))['evidence']['releaseId']
            state['latest']=str(uuid4())
            page.reload(); expect(page.get_by_text('저장 당시 지표와 분석 근거를 표시합니다.',exact=False)).to_be_visible()
            expect(page.get_by_text('999',exact=True)).to_have_count(0)
            count=len(district_reads)
            page.reload(); expect(page.get_by_text('100',exact=True).first).to_be_visible()
            assert len(district_reads)==count
            Path('outputs').mkdir(exist_ok=True)
            page.screenshot(path='outputs/saved-review-desktop.png',full_page=True)
            page.get_by_role('link',name='전략 비교',exact=True).click()
            expect(page).to_have_url(re.compile('review='))
            expect(page.get_by_role('cell',name=re.compile(r'^외지인 \+1\.7%'))).to_be_visible()
            expect(page.get_by_text('이 검토에 저장되지 않은 정책',exact=True)).to_have_count(4)
            expect(page.get_by_text('-0.8%',exact=False)).to_have_count(0)
            page.get_by_role('link',name='AI 보고서',exact=True).click()
            expect(page).to_have_url(re.compile('review='))
            expect(page.get_by_role('button',name='인쇄·PDF 저장')).to_be_enabled()
            expect(page.get_by_text('100',exact=True).first).to_be_visible()
            expect(page.get_by_text('999',exact=True)).to_have_count(0)
            assert len(district_reads)==count
            assert next(iter(reviews.values()))['evidence']['releaseId']==old_release
            page.reload(); expect(page.get_by_text('100',exact=True).first).to_be_visible()
            # A missing stored baseline must not be replaced by current live values.
            partial=copy.deepcopy(next(iter(reviews.values()))); partial_id=str(uuid4())
            partial['review'].update(id=partial_id,baseline_status='unavailable')
            partial['review']['baseline_snapshot'].update(summary=None,diagnosis=None)
            reviews[partial_id]=partial
            report_url=page.url
            page.goto(report_url.replace(parse_qs(urlsplit(report_url).query)['review'][0],partial_id))
            expect(page.get_by_text('이 검토에는 해당 기준선 자료가 저장되지 않았습니다.',exact=True).first).to_be_visible()
            expect(page.get_by_text('999',exact=True)).to_have_count(0)
            assert len(district_reads)==count
            page.goto(review_url)
            expect(page.get_by_role('heading',name='저장 조건 1',exact=True)).to_be_visible()
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
            expect(page.get_by_role('button',name='현재 자료로 검토 저장',exact=True)).to_be_disabled()
            page.goto(review_url)
            expect(page.get_by_text('+1.7%',exact=True)).to_be_visible()
            page.get_by_role('button',name='로그아웃',exact=True).click()
            expect(page.get_by_role('button',name='기관 계정 로그인')).to_be_visible()
            expect(page.get_by_text('+1.7%',exact=True)).to_have_count(0)
            page.goto(saved_url)
            page.set_viewport_size({'width':390,'height':844})
            page.get_by_role('heading',name='기관 공동 저장').scroll_into_view_if_needed()
            Path('outputs').mkdir(exist_ok=True)
            page.screenshot(path='outputs/scenario-library-mobile.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.set_viewport_size({'width':1440,'height':1000})
            page.goto(args.url + '/dashboard/seoul/11110/simulation')
            page.wait_for_load_state('networkidle')
            page.get_by_role('combobox').first.click()
            page.get_by_role('option', name='문화축제 개최', exact=True).click()
            page.get_by_role('button', name='정책 시나리오 검토', exact=True).click()
            expect(page.get_by_text('+1.7%', exact=True)).to_be_visible()
            for code in ['11710', '11740']:
                page.goto(args.url + f'/dashboard/seoul/{code}/simulation')
                page.wait_for_load_state('networkidle')
                page.get_by_role('button', name='정책 시나리오 검토', exact=True).click()
                expect(page.get_by_text('+1.7%', exact=True)).to_be_visible()
            page.get_by_role('button', name='설정', exact=True).click()
            expect(page.get_by_role('dialog')).to_be_visible()
            page.get_by_text('다크', exact=True).click()
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            page.get_by_role('button', name='설정 닫기', exact=True).click()
            page.goto(args.url + '/dashboard/busan/26710/simulation')
            page.wait_for_load_state('networkidle')
            page.get_by_role('button', name='정책 시나리오 검토', exact=True).click()
            expect(page.get_by_text('지역 근거 없음', exact=True).first).to_be_visible()
            expect(page.get_by_text('+1.7%', exact=True)).to_have_count(0)
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            for label, section in [('관광 데이터','analytics'),('AI 지역 진단','diagnosis'),('전략 비교','strategy'),('AI 보고서','report')]:
                page.get_by_role('link',name=label,exact=True).click()
                expect(page).to_have_url(re.compile('/dashboard/busan/26710/' + section + '$'))
                expect(page.get_by_role('main')).to_be_visible()
            assert not errors, errors
            print('PASS: review save/retry, frozen reload, pinned strategy/report, NULL baseline, logout isolation, login, save/retry key, units, briefing, reload, org/history, logout/viewer, mobile, national scenarios, evidence scope, theme, navigation')
        except Exception:
            Path('outputs').mkdir(exist_ok=True)
            page.screenshot(path='outputs/review-browser-failure.png',full_page=True)
            Path('outputs/review-browser-failure.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
            raise
        finally:
            browser.close()


if __name__ == '__main__':
    main()
