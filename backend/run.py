"""python -m backend.run [--key-file path] (never persists the supplied key)."""
import argparse
import os
import re
from pathlib import Path

import uvicorn
from dotenv import load_dotenv


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--key-file', type=Path)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=8000, type=int)
    parser.add_argument('--reload', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / '.env.local')
    load_dotenv(root / '.env')
    if args.key_file:
        match = re.search(r'(?:TOUR_API_SERVICE_KEY\s*=|인증키\s*:)\s*([A-Za-z0-9%+/=_-]+)', args.key_file.read_text(encoding='utf-8-sig'))
        if not match:
            parser.error('인증키 파일 형식을 확인하세요. 키 값은 출력하지 않습니다.')
        os.environ['TOUR_API_SERVICE_KEY'] = match[1]
    uvicorn.run('backend.app:app', host=args.host, port=args.port, reload=args.reload, reload_dirs=[str(root / 'backend')] if args.reload else None)


if __name__ == '__main__':
    main()
