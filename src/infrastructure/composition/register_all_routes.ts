import type { RouteRegistrationDependencies } from "../../types/route_registration_dependencies.type.ts"
import { registerCaseRoutes } from "../http/case_routes.ts"
import { registerCredentialRoutes } from "../http/credential_routes.ts"
import { registerFiledReportRoutes } from "../http/filed_report_routes.ts"
import { registerHolderRoutes } from "../http/holder_routes.ts"
import { registerPredicateRoutes } from "../http/predicate_routes.ts"
import { registerPresentationRoutes } from "../http/presentation_routes.ts"
import { registerRegistrySnapshotRoutes } from "../http/registry_snapshot_routes.ts"
import { registerReportRoutes } from "../http/report_routes.ts"
import { registerVerifierRoutes } from "../http/verifier_routes.ts"

function registerAllRoutes(dependencies: RouteRegistrationDependencies): void {
  const { server, tokens, logger, metrics, clock } = dependencies

  registerCredentialRoutes(server, {
    credentials: dependencies.credentials,
    tokens,
    logger,
    metrics,
    clock
  })

  registerPredicateRoutes(server, {
    predicates: dependencies.predicates,
    tokens,
    logger,
    metrics,
    clock
  })

  registerRegistrySnapshotRoutes(server, {
    route: "/api/v1/seal/registry/snapshot",
    snapshots: dependencies.credentialSnapshots,
    logger,
    metrics
  })

  registerRegistrySnapshotRoutes(server, {
    route: "/api/v1/seal/report-registry/snapshot",
    snapshots: dependencies.reportSnapshots,
    logger,
    metrics
  })

  registerReportRoutes(server, {
    reporters: dependencies.reporters,
    rights: dependencies.reportRights,
    tokens,
    logger,
    metrics,
    clock
  })

  registerFiledReportRoutes(server, {
    submissions: dependencies.reportSubmissions,
    rateLimiter: dependencies.reportIpLimiter,
    reportMetrics: dependencies.reportMetrics,
    metrics
  })

  registerCaseRoutes(server, {
    cases: dependencies.cases,
    tokens,
    logger,
    metrics
  })

  registerPresentationRoutes(server, {
    relay: dependencies.presentationRelay,
    statuses: dependencies.presentationStatuses,
    logger,
    metrics
  })

  registerVerifierRoutes(server, {
    assets: dependencies.verifierAssets,
    metrics
  })

  registerHolderRoutes(server, {
    assets: dependencies.holderAssets,
    metrics
  })
}

export { registerAllRoutes }
