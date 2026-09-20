"""Stdio adapter preserving the teammate's TypeScript/LangGraph implementation."""
import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path

from .core import ApiError

ROOT = Path(__file__).resolve().parent.parent


class BriefingWorker:
    def __init__(self, settings, command=None):
        self.command = command or [settings.get('NODE_EXECUTABLE') or shutil.which('node') or 'node', '--import', 'tsx', 'server/briefing/bridge.ts']
        runtime_keys = {'PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'NODE_EXTRA_CA_CERTS'}
        self.env = {k: v for k, v in os.environ.items() if k in runtime_keys}
        # Supabase 서버 키는 브라우저 대신 월간 브리핑 워커에만 전달합니다.
        self.env.update({k: settings[k] for k in ('TOUR_API_SERVICE_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY') if settings.get(k)})
        self.process, self.reader = None, None
        self.pending, self.sequence = {}, 0
        self.lock = asyncio.Lock()

    async def start(self):
        async with self.lock:
            if self.process is not None and self.process.returncode is None:
                return
            if self.reader is not None:
                await self.reader  # Finish failing old requests before a replacement worker starts.
            try:
                self.process = await asyncio.create_subprocess_exec(*self.command, cwd=ROOT, env=self.env,
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                    limit=1024 * 1024, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            except (OSError, NotImplementedError):
                raise ApiError(503, 'BRIEFING_RUNTIME', '월간 브리핑 실행 환경을 확인하세요. Node.js와 npm ci 설치가 필요합니다.') from None
            self.reader = asyncio.create_task(self.read(self.process))

    async def read(self, process):
        try:
            while line := await process.stdout.readline():
                response = json.loads(line)
                if not isinstance(response, dict) or not isinstance(response.get('status'), int) or not 100 <= response['status'] <= 599 or not isinstance(response.get('body'), dict):
                    raise ValueError('Invalid worker response')
                future = self.pending.get(response.get('id'))
                if future is not None and not future.done():
                    future.set_result(response)
        except (ValueError, OSError):
            pass
        finally:
            if process.returncode is None:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
            await process.wait()
            for future in list(self.pending.values()):
                if not future.done():
                    future.set_exception(ApiError(502, 'BRIEFING_UNAVAILABLE', '월간 브리핑 실행이 중단되었습니다. 다시 시도하세요.'))

    async def request(self, method, query):
        await self.start()
        if len(self.pending) >= 32:
            raise ApiError(429, 'BRIEFING_BUSY', '월간 브리핑 요청이 많습니다. 잠시 후 다시 시도하세요.')
        self.sequence += 1
        identifier = self.sequence
        future = asyncio.get_running_loop().create_future()
        self.pending[identifier] = future
        try:
            self.process.stdin.write((json.dumps(dict(id=identifier, method=method, query=query)) + '\n').encode())
            await self.process.stdin.drain()
            # 수집·생성뿐 아니라 마지막 DB 저장 응답까지 기다립니다.
            async with asyncio.timeout(285):
                return await future
        except TimeoutError:
            raise ApiError(504, 'BRIEFING_TIMEOUT', '월간 브리핑 생성 시간이 초과되었습니다. 다시 시도하세요.') from None
        except (BrokenPipeError, ConnectionResetError):
            raise ApiError(502, 'BRIEFING_UNAVAILABLE', '월간 브리핑 실행이 중단되었습니다. 다시 시도하세요.') from None
        finally:
            self.pending.pop(identifier, None)
            if not future.done():
                future.cancel()

    async def close(self):
        async with self.lock:
            if self.process is not None and self.process.returncode is None:
                self.process.stdin.close()
                try:
                    await asyncio.wait_for(self.process.wait(), 3)
                except TimeoutError:
                    self.process.kill()
                    await self.process.wait()
            if self.reader is not None:
                await self.reader
            self.process, self.reader = None, None
