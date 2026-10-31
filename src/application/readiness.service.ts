import type { ReadinessReport } from "../types/readiness_report.type.ts"
import type { DatabaseProbePort } from "./ports/database_probe.port.ts"
import type { SponsorConditionSourcePort } from "./ports/sponsor_condition_source.port.ts"

class Readiness {
  private readonly database: DatabaseProbePort
  private readonly sponsor: SponsorConditionSourcePort

  constructor(database: DatabaseProbePort, sponsor: SponsorConditionSourcePort) {
    this.database = database
    this.sponsor = sponsor
  }

  async report(): Promise<ReadinessReport> {
    const reachable = await this.database.reachable()
    const sponsor = this.sponsor.condition()

    return {
      ready: reachable && sponsor !== "syncing" && sponsor !== "unreachable",
      database: reachable ? "reachable" : "unreachable",
      sponsor
    }
  }
}

export default Readiness
