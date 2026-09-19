"""관광공사 국문 관광정보 searchFestival2의 행사 전체를 data/festivals_kto.json으로 저장한다.

이 API는 축제별 최신 회차만 남기므로(2022년 11월 이후), 과거 회차는 전국문화축제표준데이터로 보완한다.
"""
import json

from common import DATA, kto_items


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    items = kto_items('KorService2/searchFestival2', eventStartDate='20100101', numOfRows=5000)
    (DATA / 'festivals_kto.json').write_text(json.dumps(items, ensure_ascii=False), encoding='utf-8')
    print(f'행사 {len(items)}건 저장')


if __name__ == '__main__':
    main()
