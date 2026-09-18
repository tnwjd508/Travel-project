"""Versioned provisional rules; no fabricated values, predictions or normal-state tasks."""
from .core import meta

MODEL = dict(version='draft-1', status='provisional', description='정책 검토용 자체 규칙입니다. 인과 추정·방문자 예측·공식 관광 활성화 지수가 아닙니다.')


def mean(values):
    return None if None in values else sum(values) / len(values)


def diagnose(summary, indices, related):
    inputs = [
        ('youth', '2030 방문 지수 변화', summary['age']['momPct'], 'percent', lambda v: v < -5, '2030 대상 콘텐츠와 유입 경로 검토'),
        ('stay', '숙박 비중 지수', summary['stay']['ix2102'], 'index', lambda v: v < 80, '숙박 연계 관광 코스 검토'),
        ('concentration', '상위 3개 관광지 연관 건수 비중', related['top3Share'], 'percent', lambda v: v > 60, '연관 관광지 네트워크와 코스 다양화 검토'),
        ('spend', '관광소비강도 지수', summary['spend']['ix22'], 'index', lambda v: v < 80, '관광·상권 소비 연결 프로그램 검토'),
    ]
    issues, priorities = [], []
    for code, label, value, unit, attention, task in inputs:
        state = 'unknown' if value is None else 'attention' if attention(value) else 'normal'
        evidence = f'{label}: 데이터 부족' if value is None else f'{label}: {value:.2f}{"%" if unit == "percent" else " (지수)"}; 기준월 {summary["baseYm"]}'
        issues.append(dict(id=code, label=label, value=value, unit=unit, status=state, evidence=evidence))
        if state == 'attention' and len(priorities) < 3:
            priorities.append(dict(issueId=code, title=task, evidence=evidence))
    g = indices['groups']
    axes = [
        ('access', '운송업 소비 지수', g['demand'].get('1109')),
        ('content', '문화자연자원 수요 지수', g['culture'].get('12')),
        ('spend', '관광소비강도 지수', g['spend'].get('22')),
        ('stay', '관광체류강도 지수', g['stay'].get('21')),
        ('awareness', 'SNS 여행유형 언급 지수 평균', mean([g['demand'].get(c) for c in ('1101', '1102', '1103', '1104')])),
        ('international', '국제적 다양성 지수', g['international'].get('33')),
    ]
    activation = mean([axis[2] for axis in axes])
    warnings = list(dict.fromkeys(summary['warnings'] + indices['warnings'] + related['warnings'] + ['자체 산식 draft-1: 6축 단순평균. 팀 검토 필요. 연관 건수 비중은 방문객 집중률이 아닙니다.']))
    return dict(meta(summary['baseYm'], warnings), district=summary['district'], model=MODEL, issues=issues, priorities=priorities,
        radar=[dict(id=code, label=label, value=value) for code, label, value in axes], activationIndex=round(activation, 2) if activation is not None else None)
