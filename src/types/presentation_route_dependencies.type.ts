import type { LoggerPort } from "../application/ports/logger.port.ts"
import type PresentationRelay from "../application/presentation_relay.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type PresentationRouteDependencies = {
  relay: PresentationRelay
  logger: LoggerPort
  metrics: EstateMetrics
}

export type { PresentationRouteDependencies }
