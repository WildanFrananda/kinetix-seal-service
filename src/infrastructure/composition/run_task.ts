import type { LoggerPort } from "../../application/ports/logger.port.ts"
import type RemoteSponsorStatus from "../../application/remote_sponsor_status.service.ts"
import { repeat } from "../scheduling/repeat.ts"

async function runLogged(logger: LoggerPort, message: string, work: () => Promise<unknown>): Promise<void> {
  await work().catch((error: unknown) => {
    logger.error({ message }, error)
  })
}

function repeatWhenSponsorReady(
  seconds: number,
  sponsorStatus: RemoteSponsorStatus,
  work: () => Promise<void>
): () => void {
  return repeat(seconds, async () => {
    const condition = sponsorStatus.condition()

    if (condition === "syncing" || condition === "unreachable") {
      return
    }

    await work()
  })
}

export { repeatWhenSponsorReady, runLogged }
