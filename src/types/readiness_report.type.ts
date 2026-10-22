import type { DatabaseReachability } from "./database_reachability.type.ts"
import type { SponsorCondition } from "./sponsor_condition.type.ts"

type ReadinessReport = {
  ready: boolean
  database: DatabaseReachability
  sponsor: SponsorCondition
}

export type { ReadinessReport }
