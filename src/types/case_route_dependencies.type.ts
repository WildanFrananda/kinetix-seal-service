import type CaseCatalogue from "../application/case_catalogue.service.ts"
import type { CallerCheck } from "./caller_check.type.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type CaseRouteDependencies = CallerCheck & {
  cases: CaseCatalogue
  metrics: EstateMetrics
}

export type { CaseRouteDependencies }
