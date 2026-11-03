import type { LoggerPort } from "../application/ports/logger.port.ts"
import type PresentationRelay from "../application/presentation_relay.service.ts"
import type PresentationStatuses from "../application/presentation_statuses.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type PresentationRouteDependencies = {
  relay: PresentationRelay
  statuses: PresentationStatuses
  logger: LoggerPort
  metrics: EstateMetrics
}

export type { PresentationRouteDependencies }
