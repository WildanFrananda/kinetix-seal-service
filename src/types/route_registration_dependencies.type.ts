import type { FastifyInstance } from "fastify"

import type CaseCatalogue from "../application/case_catalogue.service.ts"
import type CourierCredentials from "../application/courier_credentials.service.ts"
import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { TokenVerifierPort } from "../application/ports/token_verifier.port.ts"
import type PredicateCatalogue from "../application/predicate_catalogue.service.ts"
import type PresentationRelay from "../application/presentation_relay.service.ts"
import type PresentationStatuses from "../application/presentation_statuses.service.ts"
import type RegistrySnapshots from "../application/registry_snapshots.service.ts"
import type ReportRights from "../application/report_rights.service.ts"
import type ReportSubmissions from "../application/report_submissions.service.ts"
import type ReporterRegistry from "../application/reporter_registry.service.ts"
import type BundleAssets from "../infrastructure/http/bundle_assets.ts"
import type KeyedIpRateLimiter from "../infrastructure/http/keyed_ip_rate_limiter.ts"
import type PrometheusReportMetrics from "../infrastructure/observability/prometheus_report_metrics.adapter.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type RouteRegistrationDependencies = {
  server: FastifyInstance
  credentials: CourierCredentials
  predicates: PredicateCatalogue
  credentialSnapshots: RegistrySnapshots
  reportSnapshots: RegistrySnapshots
  reporters: ReporterRegistry
  reportRights: ReportRights
  reportSubmissions: ReportSubmissions
  reportIpLimiter: KeyedIpRateLimiter
  reportMetrics: PrometheusReportMetrics
  cases: CaseCatalogue
  presentationRelay: PresentationRelay
  presentationStatuses: PresentationStatuses
  verifierAssets: BundleAssets
  holderAssets: BundleAssets
  tokens: TokenVerifierPort
  logger: LoggerPort
  metrics: EstateMetrics
  clock: () => Date
}

export type { RouteRegistrationDependencies }
