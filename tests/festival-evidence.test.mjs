import test from 'node:test'
import assert from 'node:assert/strict'
import { policyEvidence } from '../.test-build/src/data/festivalEffect.js'

test('광주 별칭과 전국 자치구는 같은 과거 축제 분석군을 참조한다', () => {
  const reference = policyEvidence('festival', '12210')
  assert.equal(reference.status, 'evidence_based')
  assert.equal(reference.stat.n, 271)
  assert.equal(reference.stat.meanPct, 1.7)
  assert.deepEqual(policyEvidence('festival', 'donggu'), reference)
  assert.deepEqual(policyEvidence('festival', '11110'), reference)
  assert.deepEqual(policyEvidence('festival', '11710'), reference)
  assert.deepEqual(policyEvidence('festival', '11740'), reference)
})

test('군·도 소속 시군구·잘못된 코드는 자치구 축제 통계를 적용하지 않는다', () => {
  for (const code of ['26710', '41110', '36110', 'unknown']) {
    const reference = policyEvidence('festival', code)
    assert.equal(reference.status, 'out_of_scope', code)
    assert.equal(reference.stat, null, code)
  }
})

test('야간 통계의 음수 하한과 자료가 없는 정책을 그대로 구분한다', () => {
  const night = policyEvidence('night', 'donggu')
  assert.equal(night.status, 'insufficient_evidence')
  assert.equal(night.stat.ci95Pct[0], -0.8)
  for (const policy of ['shuttle', 'market', 'art']) {
    assert.equal(policyEvidence(policy, 'donggu').status, 'model_not_connected')
    assert.equal(policyEvidence(policy, 'donggu').stat, null)
  }
})
