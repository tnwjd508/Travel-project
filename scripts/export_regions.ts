import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { regionCatalogue, districtAliases } from '../src/data/tourismRegions.js'

// The teammate's TypeScript catalogue remains the only editable source of truth.
const target = new URL('../backend/data/tourism-regions.json', import.meta.url)
const content = JSON.stringify({ ...regionCatalogue, aliases: districtAliases }, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== content) throw new Error('지역 목록이 변경되었습니다. npm run export:regions를 실행하세요.')
} else {
  await mkdir(new URL('../backend/data/', import.meta.url), { recursive: true })
  await writeFile(target, content, 'utf8')
}
console.log(`FastAPI 지역 목록 ${regionCatalogue.districts.length}개 ${process.argv.includes('--check') ? '일치 확인' : '동기화'}`)
