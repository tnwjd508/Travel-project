import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// 문서 기준은 루트 .venv이며, backend/.venv에 만든 환경도 찾는다.
const venvPython = (dir) => resolve(dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const python = process.env.PYTHON_EXECUTABLE || ['.venv', 'backend/.venv'].map(venvPython).find((path) => existsSync(path)) || venvPython('.venv')
if (!existsSync(python)) {
  console.error('Python 가상환경이 필요합니다. FASTAPI_REACT.md의 설치 명령을 실행하세요.')
  process.exit(1)
}
const children = []
// Custom ports/hosts belong to the separate-server command (backend.run).
const backendArgs = process.argv.slice(2)
for (let i = 0; i < backendArgs.length; i++) {
  if (backendArgs[i] === '--key-file' && backendArgs[i + 1]) { i++; continue }
  if (backendArgs[i] === '--reload') continue
  console.error('통합 실행은 --key-file <경로>, --reload만 지원합니다. 별도 포트는 FASTAPI_REACT.md를 참고하세요.')
  process.exit(1)
}
try {
  await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(500) })
  console.error('8000 포트에 서버가 실행 중입니다. 기존 FastAPI를 사용할 때는 npm run dev:web을 실행하세요.')
  process.exit(1)
} catch { /* no running HTTP server */ }
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop())
const backend = spawn(python, ['-m', 'backend.run', ...backendArgs], { stdio: 'inherit', windowsHide: true })
children.push(backend)
backend.on('exit', code => stop(code ?? 1))
backend.on('error', () => stop(1))
let ready = false
for (let i = 0; i < 50 && !stopping; i++) {
  try {
    const result = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(500) })
    if (result.ok && (await result.json()).backend === 'fastapi') { ready = true; break }
  } catch { /* startup in progress */ }
  await new Promise(resolve => setTimeout(resolve, 200))
}
if (!ready) { console.error('FastAPI 시작을 확인하지 못했습니다.'); stop(1) }
else if (!stopping) {
  const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, FASTAPI_BASE_URL: 'http://127.0.0.1:8000' } })
  children.push(frontend)
  frontend.on('exit', code => stop(code ?? 1))
  frontend.on('error', () => stop(1))
}
