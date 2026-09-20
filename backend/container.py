"""Same-origin container entrypoint. Credentials come only from the process environment."""
import os
import re
import shutil
import sys
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent.parent


def container_port(env=None, root=ROOT):
    env = os.environ if env is None else env
    value = env.get('PORT', '8000')
    if not re.fullmatch(r'[0-9]{1,5}', value) or not 1 <= int(value) <= 65535:
        raise ValueError('PORT must be an integer between 1 and 65535.')
    # A leftover proxy-only token would reject every browser API request with 401.
    # Do not silently disable it: require the deployment configuration to be corrected.
    if env.get('FASTAPI_PROXY_TOKEN', '').strip():
        raise ValueError('Remove FASTAPI_PROXY_TOKEN for the same-origin container deployment.')
    if not (root / 'dist/index.html').is_file():
        raise ValueError('The React build is missing: dist/index.html.')
    if not shutil.which(env.get('NODE_EXECUTABLE') or 'node'):
        raise ValueError('The Node.js runtime is missing.')
    for relative in ('node_modules/tsx/package.json', 'server/briefing/bridge.ts', 'backend/data/tourism-regions.json'):
        if not (root / relative).is_file():
            raise ValueError('The briefing runtime or region catalogue is missing.')
    return int(value)


def main():
    try:
        port = container_port()
    except ValueError as error:
        sys.exit(str(error))
    # One worker per container preserves the existing in-process cache behavior.
    # Vercel's SIGTERM grace period is 30 seconds; leave time for lifespan cleanup.
    uvicorn.run('backend.app:app', host='0.0.0.0', port=port, workers=1, timeout_graceful_shutdown=20)


if __name__ == '__main__':
    main()
