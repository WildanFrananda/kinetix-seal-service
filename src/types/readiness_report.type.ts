import type { DatabaseReachability } from "./database_reachability.type.ts"
import type { RemoteSponsorCondition } from "./remote_sponsor_condition.type.ts"

type ReadinessReport = {
  ready: boolean
  database: DatabaseReachability
  sponsor: RemoteSponsorCondition
}

export type { ReadinessReport }
