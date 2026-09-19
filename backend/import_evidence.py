"""Operator-only evidence import. Default is dry-run; --apply explicitly writes to Supabase."""
import argparse
import asyncio
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

from .core import ApiError
from .evidence import timestamp, validate_artifact
from .supabase import SupabaseDatabase, parse_uuid

ROOT = Path(__file__).resolve().parent.parent


def prepare_import(path, commit, revision=1, provenance=None, status='partial'):
    raw = Path(path).read_bytes()
    if len(raw) > 5 * 1024 * 1024:
        raise ValueError('분석 파일은 5MB 이하로 준비하세요.')
    payload = json.loads(raw.decode('utf-8-sig'), parse_constant=lambda _: (_ for _ in ()).throw(ValueError('유한한 수치만 허용합니다.')))
    validate_artifact(payload)
    if not re.fullmatch(r'[a-f0-9]{40}', commit) or type(revision) is not int or revision < 1:
        raise ValueError('커밋 또는 출처 리비전을 확인하세요.')
    provenance = {} if provenance is None else provenance
    if not isinstance(provenance, dict) or status not in ('partial', 'complete'):
        raise ValueError('출처 정보를 확인하세요.')
    if status == 'complete':
        if not re.fullmatch(r'[a-f0-9]{40}', provenance.get('producer_commit', '')) or not isinstance(provenance.get('parameters'), dict) or not isinstance(provenance.get('runtime'), dict):
            raise ValueError('실행 커밋·파라미터·런타임 정보가 필요합니다.')
        artifacts = provenance.get('raw_artifacts')
        if not isinstance(artifacts, list) or not artifacts:
            raise ValueError('원본 자료 목록이 필요합니다.')
        for artifact in artifacts:
            if not isinstance(artifact, dict):
                raise ValueError('원본 자료 항목을 확인하세요.')
            storage_path = artifact.get('storage_path', '')
            if not isinstance(storage_path, str) or len(storage_path.split('/')) < 2 or any(p in ('', '.', '..') for p in storage_path.split('/')) or any(c in storage_path for c in ('?', '#', ':', '\\')):
                raise ValueError('원본 자료는 bucket/object 형태의 고정 경로여야 합니다.')
            if not re.fullmatch(r'[a-f0-9]{64}', artifact.get('sha256', '')) or not isinstance(artifact.get('source_name'), str) or not artifact['source_name'].strip():
                raise ValueError('원본 자료 체크섬과 출처가 필요합니다.')
            timestamp(artifact.get('fetched_at'))
    return dict(p_payload=payload, p_artifact_sha256=hashlib.sha256(raw).hexdigest(), p_repository_commit=commit,
        p_provenance=provenance, p_provenance_revision=revision, p_provenance_status=status)


async def apply_import(args, env, *, transport=None):
    async with httpx.AsyncClient(transport=transport, follow_redirects=False, timeout=30) as http:
        db = SupabaseDatabase(env, http)
        if args['p_provenance_status'] == 'complete':
            for artifact in args['p_provenance']['raw_artifacts']:
                # Download only from the configured project's authenticated Storage endpoint.
                digest, size = hashlib.sha256(), 0
                url = db.base_url() + '/storage/v1/object/authenticated/' + quote(artifact['storage_path'], safe='/')
                async with http.stream('GET', url, headers=db.headers(service=True), follow_redirects=False) as response:
                    if response.status_code != 200:
                        raise ValueError('보관된 원본 자료를 읽지 못해 등록을 중단했습니다.')
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 1024 * 1024 * 1024:
                            raise ValueError('원본 자료 검증 용량 한도를 초과했습니다.')
                        digest.update(chunk)
                if digest.hexdigest() != artifact['sha256']:
                    raise ValueError('보관된 원본 자료의 체크섬이 달라 등록을 중단했습니다.')
        identifier = await db.call('POST', '/rest/v1/rpc/import_policy_evidence', payload=args, service=True)
        return parse_uuid(identifier)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, default=ROOT / 'src/assets/data/festival-effect.json')
    parser.add_argument('--repository-commit', required=True, help='분석 파일을 보관한 40자리 Git 커밋')
    parser.add_argument('--provenance', type=Path)
    parser.add_argument('--provenance-revision', type=int, default=1)
    parser.add_argument('--provenance-status', choices=['partial', 'complete'], default='partial')
    parser.add_argument('--apply', action='store_true', help='검증 후 현재 설정된 Supabase에 실제 등록')
    options = parser.parse_args()
    try:
        provenance = json.loads(options.provenance.read_text(encoding='utf-8')) if options.provenance else {}
        prepared = prepare_import(options.artifact, options.repository_commit, options.provenance_revision, provenance, options.provenance_status)
        # Import the committed artifact bytes; Git checkout CRLF conversion is not a new release.
        relative = options.artifact.resolve().relative_to(ROOT).as_posix()
        committed = subprocess.check_output(['git', 'show', options.repository_commit + ':' + relative], cwd=ROOT, stderr=subprocess.DEVNULL)
        if json.loads(committed) != prepared['p_payload']:
            raise ValueError('파일 내용이 지정한 Git 커밋과 다릅니다.')
        prepared['p_artifact_sha256'] = hashlib.sha256(committed).hexdigest()
        if not options.apply:
            print(json.dumps({'mode': 'dry-run', 'valid': True, 'statistics': 12, 'sha256': prepared['p_artifact_sha256'],
                'provenanceStatus': options.provenance_status, 'storageVerified': False}, ensure_ascii=False))
            return
        load_dotenv(ROOT / '.env.local'); load_dotenv(ROOT / '.env')
        identifier = asyncio.run(apply_import(prepared, dict(os.environ)))
        print(json.dumps({'mode': 'applied', 'releaseId': identifier}, ensure_ascii=False))
    except ApiError as error:
        parser.exit(1, error.message + '\n')
    except (ValueError, KeyError, TypeError, OSError, httpx.HTTPError, subprocess.SubprocessError):
        parser.exit(1, '등록에 실패했습니다. 파일·커밋·출처 정보와 서버 연결 설정을 확인하세요.\n')


if __name__ == '__main__':
    main()
