import { z } from 'zod'
import { savedSchema } from './scenarioClient'
import type { DistrictId } from '@/data/tourismRegions'

const number = z.number().finite().nullable()
const timestamp = z.iso.datetime({ offset: true })
const ym = z.string().regex(/^\d{6}$/)
const policy = z.enum(['night', 'festival', 'shuttle', 'market', 'art'])
const referenceStatus = z.enum(['available', 'insufficient_evidence', 'unsupported_policy', 'out_of_scope', 'not_imported'])
const baselineStatus = z.enum(['complete', 'partial', 'unavailable'])
const meta = {
  district: z.string().regex(/^\d{5}$/).transform(value => value as DistrictId), baseYm: ym, source: z.literal('출처: ⓒ한국관광공사'), fetchedAt: timestamp, warnings: z.array(z.string()),
}
export const summarySchema = z.object({ ...meta,
  indexUnit: z.literal('index'), visitorsMetric: z.literal('sum_of_daily_estimated_visitors'),
  visitors: z.object({ ym, month: z.string(), total: number, local: number, outside: number, foreign: number,
    complete: z.boolean(), observedDays: z.number().int().nonnegative(), expectedDays: z.number().int().positive(), through: z.string().nullable(), momPct: number }),
  stay: z.object({ ix21: number, ix2102: number }), spend: z.object({ ix22: number, ix2201: number }),
  demand: z.object({ ix11: number }), age: z.object({ ix3102: number, ix3103: number, momPct: number }),
})
export const diagnosisSchema = z.object({ ...meta,
  model: z.object({ version: z.string(), status: z.literal('provisional'), description: z.string() }),
  issues: z.array(z.object({ id: z.string(), label: z.string(), value: number, unit: z.enum(['index', 'percent']), status: z.enum(['attention', 'normal', 'unknown']), evidence: z.string() })),
  priorities: z.array(z.object({ issueId: z.string(), title: z.string(), evidence: z.string() })),
  radar: z.array(z.object({ id: z.string(), label: z.string(), value: number })), activationIndex: number,
})
export const evidenceSchema = z.object({
  policy, districtId: z.string(), regionId: z.string(), status: referenceStatus,
  releaseId: z.string().uuid().nullable(), statisticId: z.string().uuid().nullable(), basis: z.string(), selectionRuleVersion: z.string(),
  stat: z.object({ n: z.number().int().positive(), meanPct: z.number().finite(), medianPct: z.number().finite(),
    ci95Pct: z.tuple([z.number().finite(), z.number().finite()]), sharePositive: z.number().min(0).max(1) }).nullable(),
  metadata: z.object({ generatedAt: timestamp, visitorsFrom: z.string(), visitorsTo: z.string(), method: z.string(),
    sources: z.array(z.string()), provenanceStatus: z.enum(['partial', 'complete']) }).nullable(),
})
export type PolicyEvidence = z.infer<typeof evidenceSchema>
export const evidencePageSchema = z.object({ districtId: z.string(), regionId: z.string(), releaseId: z.string().uuid().nullable(), items: z.array(evidenceSchema) })
const reviewListItemSchema = z.object({
  id: z.string().uuid(), organization_id: z.string().uuid(), scenario_id: z.string().uuid(),
  created_by: z.string().uuid().nullable(), reference_status: referenceStatus, baseline_status: baselineStatus,
  selection_rule_version: z.string(), created_at: timestamp,
})
export const reviewPageSchema = z.object({ items: z.array(reviewListItemSchema), nextCursor: z.string().nullable() })
export type ReviewListItem = z.infer<typeof reviewListItemSchema>
export const reviewDetailSchema = z.object({ scenario: savedSchema, evidence: evidenceSchema,
  review: reviewListItemSchema.extend({ review_kind: z.literal('historical_reference'), baseline_schema_version: z.literal(1),
    evidence_statistic_id: z.string().uuid().nullable(), baseline_snapshot: z.object({
      request: z.object({ regionId: z.string(), districtId: z.string(), indexMonth: ym, visitorMonth: ym }),
      capturedAt: timestamp, summary: summarySchema.nullable(), diagnosis: diagnosisSchema.nullable(),
    }),
  }),
})
export type SavedReview = z.infer<typeof reviewDetailSchema>
export const baselineStatusLabels = { complete: '기준선 수집 완료', partial: '기준선 일부 자료 없음', unavailable: '기준선 수집 불가' }
