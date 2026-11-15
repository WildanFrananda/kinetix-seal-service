import type { FiledReportStorePort } from "../application/ports/filed_report_store.port.ts"
import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "../application/ports/registry_generation_store.port.ts"
import type { ReportChainPort } from "../application/ports/report_chain.port.ts"
import type { ReportMetricsPort } from "../application/ports/report_metrics.port.ts"

type ReportKeeperDependencies = {
  generations: RegistryGenerationStorePort
  reports: FiledReportStorePort
  chain: ReportChainPort
  metrics: ReportMetricsPort
  logger: LoggerPort
}

export type { ReportKeeperDependencies }
