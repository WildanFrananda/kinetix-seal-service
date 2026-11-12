import { randomUUID } from "node:crypto"

import { reporterRoleOf } from "../domain/reporter_role.ts"
import type { CallerPrincipal } from "../types/caller_principal.type.ts"
import type { ReporterRecord } from "../types/reporter_record.type.ts"
import type { ReporterRegistrationOutcome } from "../types/reporter_registration_outcome.type.ts"
import type { ReportMetricsPort } from "./ports/report_metrics.port.ts"
import type { ReporterStorePort } from "./ports/reporter_store.port.ts"

function answerFor(earlier: ReporterRecord, caller: CallerPrincipal): ReporterRegistrationOutcome {
  if (earlier.principalId === caller.principalId && earlier.role === reporterRoleOf(caller.role)) {
    return { kind: "existing", reporter: earlier }
  }

  return { kind: "key_taken" }
}

class ReporterRegistry {
  private readonly store: ReporterStorePort
  private readonly metrics: ReportMetricsPort

  constructor(store: ReporterStorePort, metrics: ReportMetricsPort) {
    this.store = store
    this.metrics = metrics
  }

  async register(caller: CallerPrincipal, reporterKey: bigint, at: Date): Promise<ReporterRegistrationOutcome> {
    const outcome = await this.decide(caller, reporterKey, at)

    this.metrics.registered(outcome.kind)

    return outcome
  }

  private async decide(caller: CallerPrincipal, reporterKey: bigint, at: Date): Promise<ReporterRegistrationOutcome> {
    const role = reporterRoleOf(caller.role)

    if (role === undefined) {
      return { kind: "not_a_reporter" }
    }

    const earlier = await this.store.byKey(reporterKey)

    if (earlier !== undefined) {
      return answerFor(earlier, caller)
    }

    const reporter: ReporterRecord = {
      id: randomUUID(),
      principalId: caller.principalId,
      role,
      reporterKey,
      registeredAt: at
    }

    if ((await this.store.record(reporter)) === "conflict") {
      const raced = await this.store.byKey(reporterKey)

      if (raced === undefined) {
        throw new Error("a reporter key conflicted and then could not be read")
      }

      return answerFor(raced, caller)
    }

    return { kind: "registered", reporter }
  }
}

export default ReporterRegistry
