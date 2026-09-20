import copy
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.evidence import selection, validate_artifact

ARTIFACT = json.loads((Path(__file__).resolve().parents[2] / 'tests/fixtures/festival-evidence-v1.json').read_text(encoding='utf-8'))
RELEASE = '10000000-0000-4000-8000-000000000001'
STAT = '20000000-0000-4000-8000-000000000001'
ENV = {'SUPABASE_URL': 'https://database.example', 'SUPABASE_SECRET_KEY': 'sb_secret_test'}


def release_row(identifier=RELEASE):
    return dict(id=identifier, artifact_schema_version=1, artifact_sha256='a'*64, repository_commit='b'*40,
        generated_at=ARTIFACT['generatedAt'], provenance_revision=1, provenance_status='partial', artifact_payload=ARTIFACT)


def stat_row(segment='metroGu', identifier=STAT, release=RELEASE):
    stat = ARTIFACT['outside'][segment]
    return dict(id=identifier, release_id=release, outcome='outside', segment=segment, sample_count=stat['n'],
        mean_pct=stat['meanPct'], median_pct=stat['medianPct'], ci_lower_pct=stat['ci95Pct'][0], ci_upper_pct=stat['ci95Pct'][1],
        share_positive=stat['sharePositive'], interval_level=0.95, estimate_kind='historical_adjusted_change')


def transport(request):
    assert request.headers['apikey'] == 'sb_secret_test'
    assert 'authorization' not in request.headers
    if request.url.path.endswith('policy_evidence_releases'):
        return httpx.Response(200, json=[release_row()])
    if request.url.path.endswith('policy_evidence_statistics'):
        return httpx.Response(200, json=[stat_row(request.url.params['segment'].removeprefix('eq.'))])
    raise AssertionError(request.url)


def test_artifact_and_evidence_selection_match_checked_in_data():
    assert validate_artifact(ARTIFACT) == ARTIFACT
    for district in ['donggu', '12210', '11110', '11710', '11740']:
        assert selection('festival', district)[1] == 'metroGu'
    assert selection('festival', '26710')[2] == 'out_of_scope'
    assert selection('festival', '41110')[2] == 'out_of_scope'
    assert selection('shuttle', 'donggu')[2] == 'unsupported_policy'


@pytest.mark.parametrize('field,value', [('n',True),('meanPct',float('nan')),('medianPct',float('inf')),('ci95Pct',[2,1]),('sharePositive',1.1)])
def test_invalid_statistic_is_rejected(field, value):
    data = copy.deepcopy(ARTIFACT); data['outside']['metroGu'][field] = value
    with pytest.raises(ValueError):
        validate_artifact(data)


def test_public_evidence_is_database_backed_and_does_not_expose_provenance_files():
    with TestClient(create_app(ENV, httpx.MockTransport(transport))) as client:
        result = client.get('/api/policy-evidence?district=donggu&policy=festival')
        assert result.status_code == 200
        body = result.json()
        assert body['status'] == 'available' and body['districtId'] == '12210'
        assert body['stat']['n'] == 271 and body['stat']['meanPct'] == 1.7
        assert body['releaseId'] == RELEASE and body['statisticId'] == STAT
        assert 'artifact_payload' not in result.text and 'secret' not in result.text
        assert result.headers['cache-control'] == 'no-store'
        assert client.get('/api/policy-evidence?district=donggu&policy=night').json()['status'] == 'insufficient_evidence'
        assert client.get('/api/policy-evidence?district=26710&policy=festival').json()['status'] == 'out_of_scope'
        assert client.get('/api/policy-evidence?district=donggu&policy=shuttle').json()['status'] == 'unsupported_policy'


def test_no_import_is_distinct_from_database_failure_and_never_falls_back_to_bundle():
    with TestClient(create_app(ENV, httpx.MockTransport(lambda _: httpx.Response(200,json=[])))) as client:
        assert client.get('/api/policy-evidence?district=donggu&policy=festival').json()['status'] == 'not_imported'
        assert client.get(f'/api/policy-evidence?district=donggu&policy=festival&releaseId={RELEASE}').status_code == 404
    with TestClient(create_app({})) as client:
        result = client.get('/api/policy-evidence?district=donggu&policy=festival')
        assert result.status_code == 503 and '1.7' not in result.text


def test_evidence_queries_reject_unknown_duplicates_and_region_mismatch():
    with TestClient(create_app({})) as client:
        for query in ['district=donggu&policy=other', 'district=donggu&policy=festival&policy=night',
            'district=donggu&policy=festival&regionId=seoul', 'district=donggu&policy=festival&releaseId=invalid']:
            assert client.get('/api/policy-evidence?' + query).status_code == 400


def test_collection_pins_one_release_for_all_policies():
    calls=[]
    def respond(request):
        calls.append(request)
        if request.url.path.endswith('policy_evidence_releases'):
            assert request.url.params['id']=='eq.'+RELEASE
            return httpx.Response(200,json=[release_row()])
        assert request.url.params['release_id']=='eq.'+RELEASE
        return httpx.Response(200,json=[stat_row('metroGu'),stat_row('night')])
    with TestClient(create_app(ENV,httpx.MockTransport(respond))) as client:
        result=client.get('/api/policy-evidence',params={'district':'11710','releaseId':RELEASE})
        assert result.status_code==200,result.text
        data=result.json()
        assert len(data['items'])==5 and data['releaseId']==RELEASE
        assert [row['policy'] for row in data['items'] if row['status']=='available']==['festival']
        assert len(calls)==2
