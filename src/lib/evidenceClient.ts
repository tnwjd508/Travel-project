import { z } from 'zod'

const timestamp = z.iso.datetime({ offset: true })
const policy = z.enum(['night', 'festival', 'shuttle', 'market', 'art'])
const referenceStatus = z.enum(['available', 'insufficient_evidence', 'unsupported_policy', 'out_of_scope', 'not_imported'])

export const evidenceSchema = z.object({
  policy, districtId: z.string(), regionId: z.string(), status: referenceStatus,
  releaseId: z.string().uuid().nullable(), statisticId: z.string().uuid().nullable(), basis: z.string(), selectionRuleVersion: z.string(),
  stat: z.object({ n: z.number().int().positive(), meanPct: z.number().finite(), medianPct: z.number().finite(),
    ci95Pct: z.tuple([z.number().finite(), z.number().finite()]), sharePositive: z.number().min(0).max(1) }).nullable(),
  metadata: z.object({ generatedAt: timestamp, visitorsFrom: z.string(), visitorsTo: z.string(), method: z.string(),
    sources: z.array(z.string()), provenanceStatus: z.enum(['partial', 'complete']) }).nullable(),
})

export type PolicyEvidence = z.infer<typeof evidenceSchema>
export const evidencePageSchema = z.object({
  districtId: z.string(), regionId: z.string(), releaseId: z.string().uuid().nullable(), items: z.array(evidenceSchema),
})
