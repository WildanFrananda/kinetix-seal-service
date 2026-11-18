import { fileURLToPath } from "node:url"
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider"
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { Registry } from "prom-client"

import CaseCatalogue from "./application/case_catalogue.service.ts"
import CourierCredentials from "./application/courier_credentials.service.ts"
import CourierFacts from "./application/courier_facts.service.ts"
import CredentialIssuer from "./application/credential_issuer.service.ts"
import DeliveredOrders from "./application/delivered_orders.service.ts"
import type { LoggerPort } from "./application/ports/logger.port.ts"
import PredicateCatalogue from "./application/predicate_catalogue.service.ts"
import PredicateKeeper from "./application/predicate_keeper.service.ts"
import PresentationRelay from "./application/presentation_relay.service.ts"
import PresentationStatuses from "./application/presentation_statuses.service.ts"
import Readiness from "./application/readiness.service.ts"
import RegistryGenerations from "./application/registry_generations.service.ts"
import RegistrySnapshots from "./application/registry_snapshots.service.ts"
import RemoteSponsorStatus from "./application/remote_sponsor_status.service.ts"
import ReportKeeper from "./application/report_keeper.service.ts"
import ReportRights from "./application/report_rights.service.ts"
import ReportSubmissions from "./application/report_submissions.service.ts"
import ReporterRegistry from "./application/reporter_registry.service.ts"
import RightGranter from "./application/right_granter.service.ts"
import { presentationStatusMaxAgeSeconds } from "./domain/presentation_status_age.ts"
import { registrySnapshotMaxAgeSeconds } from "./domain/registry_snapshot_age.ts"
import { registerAllRoutes } from "./infrastructure/composition/register_all_routes.ts"
import { repeatWhenSponsorReady, runLogged } from "./infrastructure/composition/run_task.ts"
import { readServiceConfig } from "./infrastructure/config/read_service_config.ts"
import GrpcDeliveryFeed from "./infrastructure/grpc/grpc_delivery_feed.adapter.ts"
import GrpcMerchantInfo from "./infrastructure/grpc/grpc_merchant_info.adapter.ts"
import GrpcOrderLifecycleFeed from "./infrastructure/grpc/grpc_order_lifecycle_feed.adapter.ts"
import GrpcReviewFeed from "./infrastructure/grpc/grpc_review_feed.adapter.ts"
import BundleAssets from "./infrastructure/http/bundle_assets.ts"
import { buildHttpServer } from "./infrastructure/http/http_server.ts"
import KeyedIpRateLimiter from "./infrastructure/http/keyed_ip_rate_limiter.ts"
import JoseTokenVerifier from "./infrastructure/identity/jose_token_verifier.adapter.ts"
import { loadMeshIdentity } from "./infrastructure/mesh/mesh_identity.ts"
import { withProjectId } from "./infrastructure/midnight/blockfrost_url.ts"
import { contractBuildDigest } from "./infrastructure/midnight/contract_build_digest.ts"
import { credentialRegistryDirectory } from "./infrastructure/midnight/credential_registry_contract.ts"
import IndexerBlocks from "./infrastructure/midnight/indexer_blocks.ts"
import LedgerPresentationInspector from "./infrastructure/midnight/ledger_presentation_inspector.ts"
import LedgerReportInspector from "./infrastructure/midnight/ledger_report_inspector.ts"
import MidnightCredentialChain from "./infrastructure/midnight/midnight_credential_chain.adapter.ts"
import MidnightRegistryChain from "./infrastructure/midnight/midnight_registry_chain.adapter.ts"
import MidnightReportChain from "./infrastructure/midnight/midnight_report_chain.adapter.ts"
import MidnightReportRegistryChain from "./infrastructure/midnight/midnight_report_registry_chain.adapter.ts"
import { reportRegistryDirectory } from "./infrastructure/midnight/report_registry_contract.ts"
import { serviceSecrets } from "./infrastructure/midnight/seal_secrets.ts"
import { estateMetrics } from "./infrastructure/observability/estate_metrics.ts"
import JsonLogger from "./infrastructure/observability/json_logger.ts"
import PrometheusCredentialMetrics from "./infrastructure/observability/prometheus_credential_metrics.adapter.ts"
import PrometheusFeedMetrics from "./infrastructure/observability/prometheus_feed_metrics.adapter.ts"
import PrometheusPredicateMetrics from "./infrastructure/observability/prometheus_predicate_metrics.adapter.ts"
import PrometheusPresentationMetrics from "./infrastructure/observability/prometheus_presentation_metrics.adapter.ts"
import PrometheusRegistryGauges from "./infrastructure/observability/prometheus_registry_gauges.adapter.ts"
import PrometheusReportMetrics from "./infrastructure/observability/prometheus_report_metrics.adapter.ts"
import { redactOutput } from "./infrastructure/observability/redacting_output.ts"
import PrismaCaseStore from "./infrastructure/postgres/prisma_case_store.adapter.ts"
import { createPrismaClient } from "./infrastructure/postgres/prisma_client.ts"
import PrismaCourierFactStore from "./infrastructure/postgres/prisma_courier_fact_store.adapter.ts"
import PrismaCredentialStore from "./infrastructure/postgres/prisma_credential_store.adapter.ts"
import PrismaDatabaseProbe from "./infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaDeliveredOrderStore from "./infrastructure/postgres/prisma_delivered_order_store.adapter.ts"
import PrismaFiledReportStore from "./infrastructure/postgres/prisma_filed_report_store.adapter.ts"
import PrismaPredicatePlacementStore from "./infrastructure/postgres/prisma_predicate_placement_store.adapter.ts"
import PrismaPredicateTemplateStore from "./infrastructure/postgres/prisma_predicate_template_store.adapter.ts"
import PrismaRegistryGenerationStore from "./infrastructure/postgres/prisma_registry_generation_store.adapter.ts"
import PrismaReportCategoryStore from "./infrastructure/postgres/prisma_report_category_store.adapter.ts"
import PrismaReportRightStore from "./infrastructure/postgres/prisma_report_right_store.adapter.ts"
import PrismaReporterStore from "./infrastructure/postgres/prisma_reporter_store.adapter.ts"
import { repeat } from "./infrastructure/scheduling/repeat.ts"
import { onTermination } from "./infrastructure/shutdown/on_termination.ts"
import HttpsSponsorClient from "./infrastructure/sponsor/https_sponsor_client.ts"

function now(): Date {
  return new Date()
}

const service = "kinetix-seal-service"
const config = readServiceConfig(process.env)

redactOutput(serviceSecrets(config))

const logger: LoggerPort = new JsonLogger(service, config.logLevel, (line) => {
  process.stdout.write(line)
})

const registry = new Registry()
const metrics = estateMetrics(registry, service, config.serviceVersion)
const registryGauges = new PrometheusRegistryGauges(registry)
const prisma = createPrismaClient(config.databaseUrl)
const meshIdentity = loadMeshIdentity(config.mesh)
const deliveryFeed = new GrpcDeliveryFeed(config.facts.matchingAddress, meshIdentity, config.facts.callTimeoutSeconds)
const reviewFeed = new GrpcReviewFeed(config.facts.reviewAddress, meshIdentity, config.facts.callTimeoutSeconds)
const orderFeed = new GrpcOrderLifecycleFeed(config.facts.orderAddress, meshIdentity, config.facts.callTimeoutSeconds)
const merchantInfo = new GrpcMerchantInfo(
  config.identityServiceAddress,
  meshIdentity,
  config.identity.timeoutSeconds,
  logger
)

const feedMetrics = new PrometheusFeedMetrics(registry)
const feedLimits = { pageSize: config.facts.pageSize, pagesPerTick: config.facts.pagesPerTick }
const courierFactStore = new PrismaCourierFactStore(prisma)
const courierFacts = new CourierFacts(deliveryFeed, reviewFeed, courierFactStore, feedMetrics, logger, feedLimits)
const deliveredOrders = new DeliveredOrders(
  orderFeed,
  new PrismaDeliveredOrderStore(prisma),
  feedMetrics,
  logger,
  feedLimits
)

const sponsor = new HttpsSponsorClient(
  config.sponsor.url,
  meshIdentity,
  config.sponsor.timeoutSeconds,
  config.midnightStepSeconds
)

const sponsorStatus = new RemoteSponsorStatus(sponsor, logger)
const readiness = new Readiness(new PrismaDatabaseProbe(prisma), sponsorStatus)
const midnightConfig = { networkId: config.midnight.networkId, ttlSeconds: 3600 }
const zkConfig = new NodeZkConfigProvider<string>(credentialRegistryDirectory)
const publicData = indexerPublicDataProvider({
  queryURL: withProjectId(config.midnight.indexerHttpUrl, config.blockfrostProjectId),
  subscriptionURL: withProjectId(config.midnight.indexerWsUrl, config.blockfrostProjectId)
})

const proofs = httpClientProofProvider({ url: config.midnight.proofServerUrl, zkConfigProvider: zkConfig })
const reportZkConfig = new NodeZkConfigProvider<string>(reportRegistryDirectory)
const reportProofs = httpClientProofProvider({ url: config.midnight.proofServerUrl, zkConfigProvider: reportZkConfig })
const blocks = new IndexerBlocks(config.midnight.indexerHttpUrl, config.blockfrostProjectId, config.midnightStepSeconds)
const generationStore = new PrismaRegistryGenerationStore(prisma, "credential")
const reportGenerationStore = new PrismaRegistryGenerationStore(prisma, "report")
const credentialStore = new PrismaCredentialStore(prisma)
const credentialMetrics = new PrometheusCredentialMetrics(registry)
const registryGenerations = new RegistryGenerations(
  "credential",
  new MidnightRegistryChain({
    payer: sponsor,
    publicData,
    proofs,
    zkConfig,
    blocks,
    issuerSecret: config.issuerSecret,
    config: midnightConfig,
    networkStepSeconds: config.midnightStepSeconds
  }),
  generationStore,
  registryGauges.of("credential"),
  logger,
  config.midnight.networkId,
  await contractBuildDigest(credentialRegistryDirectory)
)

const reportRegistryGenerations = new RegistryGenerations(
  "report",
  new MidnightReportRegistryChain({
    payer: sponsor,
    publicData,
    proofs: reportProofs,
    zkConfig: reportZkConfig,
    blocks,
    issuerSecret: config.issuerSecret,
    config: midnightConfig,
    networkStepSeconds: config.midnightStepSeconds
  }),
  reportGenerationStore,
  registryGauges.of("report"),
  logger,
  config.midnight.networkId,
  await contractBuildDigest(reportRegistryDirectory)
)

const reportChain = new MidnightReportChain({
  payer: sponsor,
  publicData,
  proofs: reportProofs,
  zkConfig: reportZkConfig,
  issuerSecret: config.issuerSecret,
  config: midnightConfig,
  networkStepSeconds: config.midnightStepSeconds
})

const reportMetrics = new PrometheusReportMetrics(registry)
const reportRightStore = new PrismaReportRightStore(prisma)
const reportRights = new ReportRights(
  reportRightStore,
  reportChain,
  reportGenerationStore,
  reportMetrics,
  now,
  config.facts.pageSize
)

const rightGranter = new RightGranter(reportChain, reportRightStore, reportGenerationStore, reportMetrics, logger, now)
const filedReportStore = new PrismaFiledReportStore(prisma)
const reportSubmissions = new ReportSubmissions({
  categories: new PrismaReportCategoryStore(prisma),
  generations: reportGenerationStore,
  reports: filedReportStore,
  inspector: new LedgerReportInspector(),
  chain: reportChain,
  payer: sponsor,
  metrics: reportMetrics,
  logger,
  minimumHolders: config.reports.minimumHolders
})

const reportKeeper = new ReportKeeper({
  generations: reportGenerationStore,
  reports: filedReportStore,
  chain: reportChain,
  metrics: reportMetrics,
  logger
})

const registryChain = new MidnightCredentialChain({
  payer: sponsor,
  publicData,
  proofs,
  zkConfig,
  issuerSecret: config.issuerSecret,
  config: midnightConfig,
  networkStepSeconds: config.midnightStepSeconds
})

const credentialIssuer = new CredentialIssuer(
  registryChain,
  credentialStore,
  generationStore,
  credentialMetrics,
  logger,
  now
)

const predicateTemplates = new PrismaPredicateTemplateStore(prisma)
const predicatePlacements = new PrismaPredicatePlacementStore(prisma)
const predicateKeeper = new PredicateKeeper({
  chain: registryChain,
  templates: predicateTemplates,
  placements: predicatePlacements,
  generations: generationStore,
  metrics: new PrometheusPredicateMetrics(registry),
  logger,
  clock: now,
  periodDays: config.predicates.periodDays
})

const server = buildHttpServer({ service, readiness, registry, metrics, logger })

registerAllRoutes({
  server,
  credentials: new CourierCredentials(
    courierFactStore,
    credentialStore,
    generationStore,
    credentialMetrics,
    config.credentials.factsMaxAgeSeconds
  ),
  predicates: new PredicateCatalogue({
    chain: registryChain,
    templates: predicateTemplates,
    placements: predicatePlacements,
    generations: generationStore,
    logger,
    periodDays: config.predicates.periodDays
  }),
  credentialSnapshots: new RegistrySnapshots(registryChain, generationStore, registrySnapshotMaxAgeSeconds, now),
  reportSnapshots: new RegistrySnapshots(registryChain, reportGenerationStore, registrySnapshotMaxAgeSeconds, now),
  reporters: new ReporterRegistry(new PrismaReporterStore(prisma), reportMetrics),
  reportRights,
  reportSubmissions,
  reportIpLimiter: new KeyedIpRateLimiter(config.reports.ipLimitMax, config.reports.ipLimitWindowSeconds),
  reportMetrics,
  cases: new CaseCatalogue({
    cases: new PrismaCaseStore(prisma, config.issuerSecret),
    merchants: merchantInfo,
    issuerSecret: config.issuerSecret
  }),
  presentationRelay: new PresentationRelay({
    inspector: new LedgerPresentationInspector(),
    payer: sponsor,
    generations: generationStore,
    metrics: new PrometheusPresentationMetrics(registry)
  }),
  presentationStatuses: new PresentationStatuses(registryChain, generationStore, presentationStatusMaxAgeSeconds, now),
  verifierAssets: BundleAssets.load(fileURLToPath(new URL("../verifier-bundle/", import.meta.url)), [
    "verifier.js",
    "verifier.css"
  ]),
  holderAssets: BundleAssets.load(fileURLToPath(new URL("../holder-bundle/", import.meta.url)), [
    "index.html",
    "holder.js"
  ]),
  tokens: new JoseTokenVerifier(config.identity),
  logger,
  metrics,
  clock: now
})

const stops: Array<() => void> = []

onTermination(
  config.shutdownGraceSeconds,
  async () => {
    logger.info({ message: "draining" })

    for (const stop of stops) {
      stop()
    }

    await server.close()
    deliveryFeed.close()
    orderFeed.close()
    reviewFeed.close()
    merchantInfo.close()
    sponsor.close()
    await prisma.$disconnect()
  },
  (error) => {
    logger.error({ message: "the shutdown failed" }, error)
  }
)

await server.listen({ host: "0.0.0.0", port: config.httpPort })
logger.info({ message: "serving HTTP", fields: { port: config.httpPort, version: config.serviceVersion } })

await sponsorStatus.refresh()

stops.push(
  repeat(config.sponsor.pollSeconds, async () => {
    await sponsorStatus.refresh()
  }),
  repeat(config.facts.tickSeconds, async () => {
    await runLogged(logger, "the courier facts could not be read", () => courierFacts.drain())
    await runLogged(logger, "the delivered orders could not be read", () => deliveredOrders.drain())
  }),
  repeatWhenSponsorReady(config.registryCheckSeconds, sponsorStatus, async () => {
    await runLogged(logger, "the credential registry could not be reconciled", () => registryGenerations.reconcile())
    await runLogged(logger, "the report registry could not be reconciled", () => reportRegistryGenerations.reconcile())
  }),
  repeatWhenSponsorReady(config.credentials.issueSeconds, sponsorStatus, async () => {
    await runLogged(logger, "the credential queue could not be settled", () => credentialIssuer.settle())
  }),
  repeat(config.reports.grantSeconds, async () => {
    await runLogged(logger, "the report rights could not be added", () => reportRights.addDue())

    const condition = sponsorStatus.condition()

    if (condition === "syncing" || condition === "unreachable") {
      return
    }

    await runLogged(logger, "the report rights could not be granted", () => rightGranter.settle())
  }),
  repeatWhenSponsorReady(config.predicates.reconcileSeconds, sponsorStatus, async () => {
    await runLogged(logger, "the registry's predicates could not be reconciled", () => predicateKeeper.reconcile())
  }),
  repeatWhenSponsorReady(config.reports.keepSeconds, sponsorStatus, async () => {
    await runLogged(logger, "filed anonymous reports could not be kept in the registry", () => reportKeeper.keep())
  })
)
