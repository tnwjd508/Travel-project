import os
import subprocess
import sys
import time

import httpx
import pytest

from backend.container import ROOT, container_port


@pytest.mark.parametrize('value', ['', '0', '65536', '-1', '8000;echo test', ' 8000', 'not-a-port'])
def test_container_rejects_invalid_port_without_echoing_it(value):
    with pytest.raises(ValueError, match='PORT must be an integer'):
        container_port({'PORT': value})


def test_container_rejects_proxy_token_instead_of_silently_disabling_auth():
    env = {'FASTAPI_PROXY_TOKEN': 'private-test-token'}
    with pytest.raises(ValueError, match='Remove FASTAPI_PROXY_TOKEN') as result:
        container_port(env)
    assert 'private-test-token' not in str(result.value)
    assert env['FASTAPI_PROXY_TOKEN'] == 'private-test-token'


def test_container_requires_built_assets_and_uses_port_override(tmp_path):
    with pytest.raises(ValueError, match='React build is missing'):
        container_port({}, root=tmp_path)
    for relative in ('dist/index.html', 'node_modules/tsx/package.json', 'server/briefing/bridge.ts', 'backend/data/tourism-regions.json'):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('{}', encoding='utf-8')
    assert container_port({}, root=tmp_path) == 8000
    assert container_port({'PORT': '8123'}, root=tmp_path) == 8123


@pytest.mark.skipif(not (ROOT / 'dist/index.html').is_file(), reason='Run npm run build before container startup verification')
def test_container_entrypoint_serves_react_api_and_real_node_bridge(free_tcp_port):
    # No .env loading and no production credentials or outbound API requests.
    runtime_keys = {'PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'}
    env = {key: value for key, value in os.environ.items() if key in runtime_keys}
    env['PORT'] = str(free_tcp_port)
    process = subprocess.Popen([sys.executable, '-m', 'backend.container'], cwd=ROOT, env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        with httpx.Client(base_url=f'http://127.0.0.1:{free_tcp_port}', timeout=12) as client:
            deadline = time.monotonic() + 15
            while True:
                assert process.poll() is None, 'Container entrypoint exited before serving requests'
                try:
                    result = client.get('/api/health')
                    break
                except httpx.ConnectError:
                    if time.monotonic() >= deadline:
                        pytest.fail('Container entrypoint did not start')
                    time.sleep(.1)
            assert result.status_code == 200 and result.json()['tourApiConfigured'] is False
            assert client.get('/api/regions').status_code == 200
            assert client.get('/api/unknown').status_code == 404
            assert client.get('/api/account/config').status_code == 503
            page = client.get('/dashboard/gwangju/donggu/overview')
            assert page.status_code == 200 and '<div id="root">' in page.text
            assert client.get('/backend/app.py').text == page.text  # SPA fallback, never source code
            # An invalid district is rejected by the actual TypeScript service before external calls.
            briefing = client.get('/api/monthly-briefing?district=invalid&month=2026-08')
            assert briefing.status_code == 400 and briefing.json()['code'] == 'INVALID_QUERY'
    finally:
        process.terminate()
        process.wait(timeout=10)
