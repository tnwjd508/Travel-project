import hashlib
import json
from pathlib import Path

import httpx
import pytest

from backend.import_evidence import apply_import, prepare_import

ARTIFACT=Path(__file__).resolve().parents[2]/'src/assets/data/festival-effect.json'
COMMIT='f25dc8673420c451d3fdb4482fce5feb00a485f1'
ENV={'SUPABASE_URL':'https://database.example','SUPABASE_SECRET_KEY':'sb_secret_test'}


def test_import_preparation_hashes_actual_bytes_and_defaults_to_partial():
    args=prepare_import(ARTIFACT,COMMIT)
    assert args['p_artifact_sha256']==hashlib.sha256(ARTIFACT.read_bytes()).hexdigest()
    assert args['p_provenance_status']=='partial'


def provenance(path='raw/visitors.csv', digest=None):
    return {'producer_commit':COMMIT,'parameters':{'seed':42},'runtime':{'python':'3.12'},
        'raw_artifacts':[{'storage_path':path,'sha256':digest or hashlib.sha256(b'actual bytes').hexdigest(),
            'source_name':'test provider','fetched_at':'2026-09-20T00:00:00Z'}]}


@pytest.mark.parametrize('path',['../private','raw/../secret','https://outside.test/file','raw/file?token=secret','raw\\file'])
def test_complete_provenance_cannot_choose_an_external_or_traversal_url(path):
    with pytest.raises(ValueError): prepare_import(ARTIFACT,COMMIT,provenance=provenance(path),status='complete')


def test_complete_import_checks_real_storage_bytes_before_rpc():
    import asyncio
    calls=[]
    def transport(request):
        calls.append(request.url.path)
        assert request.url.host=='database.example' and request.headers['apikey']=='sb_secret_test'
        if request.url.path.startswith('/storage/'):
            return httpx.Response(200,content=b'actual bytes')
        return httpx.Response(200,json='10000000-0000-4000-8000-000000000001')
    args=prepare_import(ARTIFACT,COMMIT,provenance=provenance(),status='complete')
    assert asyncio.run(apply_import(args,ENV,transport=httpx.MockTransport(transport)))
    assert calls==['/storage/v1/object/authenticated/raw/visitors.csv','/rest/v1/rpc/import_policy_evidence']
    calls.clear()
    args=prepare_import(ARTIFACT,COMMIT,provenance=provenance(digest='a'*64),status='complete')
    with pytest.raises(ValueError): asyncio.run(apply_import(args,ENV,transport=httpx.MockTransport(transport)))
    assert len(calls)==1


def test_complete_provenance_requires_text_source_name():
    manifest=provenance(); manifest['raw_artifacts'][0]['source_name']={'invalid':'object'}
    with pytest.raises(ValueError): prepare_import(ARTIFACT,COMMIT,provenance=manifest,status='complete')


def test_cli_dry_run_hash_is_the_cited_git_blob():
    import subprocess,sys
    root=Path(__file__).resolve().parents[2]
    blob=subprocess.check_output(['git','show',COMMIT+':src/assets/data/festival-effect.json'],cwd=root)
    result=subprocess.check_output([sys.executable,'-m','backend.import_evidence','--repository-commit',COMMIT],cwd=root)
    assert json.loads(result)['sha256']==hashlib.sha256(blob).hexdigest()
