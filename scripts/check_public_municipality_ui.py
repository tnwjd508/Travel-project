"""Verify the contest flow: municipality selection without account login."""
import argparse
import re
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5181')
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='msedge', headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(args.url + '/regions/gwangju')
            page.wait_for_load_state('networkidle')
            with page.expect_request(lambda request: '/api/monthly-briefing?' in request.url) as briefing_request:
                page.get_by_role('button', name='동구 선택', exact=True).click()
            expect(page).to_have_url(re.compile(r'/dashboard/gwangju/12210/overview$'))
            expect(page.get_by_text('지자체 대시보드', exact=True)).to_be_visible()
            query = parse_qs(urlsplit(briefing_request.value.url).query)
            assert query['regionId'] == ['gwangju'], query
            assert query['district'] == ['12210'], query

            # Existing bookmarks remain usable but immediately canonicalize to the public ID.
            page.goto(args.url + '/dashboard/gwangju/donggu/simulation')
            page.wait_for_load_state('networkidle')
            expect(page).to_have_url(re.compile(r'/dashboard/gwangju/12210/simulation$'))
            expect(page.get_by_text('정책 조건을 설계하세요', exact=True)).to_be_visible()
            expect(page.get_by_text('기관 계정 로그인', exact=True)).to_have_count(0)
            expect(page.get_by_text('기관 공동 저장', exact=True)).to_have_count(0)
            assert not errors, errors
            print('PASS: municipality ID routing, briefing query, alias redirect, no login UI')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
