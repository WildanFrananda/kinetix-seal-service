import { courierClassId } from "../../src/domain/credential_classes.ts"
import type { PredicateTemplate } from "../../src/types/predicate_template.type.ts"

function predicateTemplate(overrides: Partial<PredicateTemplate>): PredicateTemplate {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    classId: courierClassId,
    label: "Experienced courier",
    minimums: [100n, 450n, 90n],
    freshnessDays: 30,
    approvedBy: "adm_1",
    approvedAt: new Date("2026-11-02T03:00:00Z"),
    withdrawnBy: undefined,
    withdrawnAt: undefined,
    ...overrides
  }
}

export { predicateTemplate }
