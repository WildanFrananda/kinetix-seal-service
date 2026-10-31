import type { RemoteSponsorCondition } from "../types/remote_sponsor_condition.type.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { SponsorConditionSourcePort } from "./ports/sponsor_condition_source.port.ts"
import type { SponsorStateSourcePort } from "./ports/sponsor_state_source.port.ts"

class RemoteSponsorStatus implements SponsorConditionSourcePort {
  private readonly source: SponsorStateSourcePort
  private readonly logger: LoggerPort
  private current: RemoteSponsorCondition = "unreachable"

  constructor(source: SponsorStateSourcePort, logger: LoggerPort) {
    this.source = source
    this.logger = logger
  }

  condition(): RemoteSponsorCondition {
    return this.current
  }

  async refresh(): Promise<RemoteSponsorCondition> {
    const next = await this.source.state().then(
      (state) => state.condition,
      (error: unknown) => {
        if (this.current !== "unreachable") {
          this.logger.warn({
            message: "the sponsor cannot be reached",
            fields: { cause: error instanceof Error ? error.message : String(error) }
          })
        }

        return "unreachable" as const
      }
    )

    if (next !== this.current) {
      this.logger.info({ message: "the sponsor's condition changed", fields: { from: this.current, to: next } })
      this.current = next
    }

    return next
  }
}

export default RemoteSponsorStatus
