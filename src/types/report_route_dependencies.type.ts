import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { TokenVerifierPort } from "../application/ports/token_verifier.port.ts"
import type ReportRights from "../application/report_rights.service.ts"
import type ReporterRegistry from "../application/reporter_registry.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type ReportRouteDependencies = {
  reporters: ReporterRegistry
  rights: ReportRights
  tokens: TokenVerifierPort
  logger: LoggerPort
  metrics: EstateMetrics
  clock: () => Date
}

export type { ReportRouteDependencies }
