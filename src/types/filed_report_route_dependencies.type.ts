import type { ReportMetricsPort } from "../application/ports/report_metrics.port.ts"
import type ReportSubmissions from "../application/report_submissions.service.ts"
import type KeyedIpRateLimiter from "../infrastructure/http/keyed_ip_rate_limiter.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type FiledReportRouteDependencies = {
  submissions: ReportSubmissions
  rateLimiter: KeyedIpRateLimiter
  reportMetrics: ReportMetricsPort
  metrics: EstateMetrics
}

export type { FiledReportRouteDependencies }
