import type { FiledReportStorePort } from "../application/ports/filed_report_store.port.ts"
import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "../application/ports/registry_generation_store.port.ts"
import type { ReportCategoryStorePort } from "../application/ports/report_category_store.port.ts"
import type { ReportChainPort } from "../application/ports/report_chain.port.ts"
import type { ReportInspectorPort } from "../application/ports/report_inspector.port.ts"
import type { ReportMetricsPort } from "../application/ports/report_metrics.port.ts"
import type { TransactionPayerPort } from "../application/ports/transaction_payer.port.ts"

type ReportSubmissionsDependencies = {
  categories: ReportCategoryStorePort
  generations: RegistryGenerationStorePort
  reports: FiledReportStorePort
  inspector: ReportInspectorPort
  chain: ReportChainPort
  payer: TransactionPayerPort
  metrics: ReportMetricsPort
  logger: LoggerPort
  minimumHolders: number
}

export type { ReportSubmissionsDependencies }
