import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import type { FastifyInstance } from "fastify"
import { Registry } from "prom-client"
import Readiness from "../../src/application/readiness.service.ts"
import ReportSubmissions from "../../src/application/report_submissions.service.ts"
import { reportDigestOf } from "../../src/domain/report_digest.ts"
import { registerFiledReportRoutes } from "../../src/infrastructure/http/filed_report_routes.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import KeyedIpRateLimiter from "../../src/infrastructure/http/keyed_ip_rate_limiter.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import PrometheusReportMetrics from "../../src/infrastructure/observability/prometheus_report_metrics.adapter.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakeFiledReportStore from "../fakes/fake_filed_report_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeReportCategoryStore from "../fakes/fake_report_category_store.ts"
import FakeReportChain from "../fakes/fake_report_chain.ts"
import FakeReportInspector from "../fakes/fake_report_inspector.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingTransactionPayer from "../fakes/recording_transaction_payer.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const contractAddress = "0201aa"
const saltBytes = new Uint8Array(32).fill(0x7a)
const saltHex = Buffer.from(saltBytes).toString("hex")
const nullifierBytes = new Uint8Array(32).fill(0x55)
const nullifierHex = Buffer.from(nullifierBytes).toString("hex")
const merchantTagBytes = new Uint8Array(32).fill(0x66)
const merchantTagHex = Buffer.from(merchantTagBytes).toString("hex")
const validTxBase64 = Buffer.from([1, 2, 3, 4]).toString("base64")

function createHarness(minimumHolders = 20, ipLimitMax = 2) {
  const categories = new FakeReportCategoryStore()
  const generations = new FakeRegistryGenerationStore([registryGeneration({ generation: 1, contractAddress })])
  const reports = new FakeFiledReportStore()
  const inspector = new FakeReportInspector()
  const chain = new FakeReportChain()
  const payer = new RecordingTransactionPayer()
  const registry = new Registry()
  const metrics = estateMetrics(registry, "seal", "0123abc")
  const reportMetrics = new PrometheusReportMetrics(registry)
  const logger = new RecordingLogger()

  reports.setHolders(1, merchantTagHex, 682n, minimumHolders)
  inspector.result = {
    calls: [
      {
        address: contractAddress,
        entryPoint: "report",
        nullifier: nullifierBytes,
        merchantTag: merchantTagBytes,
        window: 682n,
        digest: reportDigestOf("fraud", "damaged box with missing seal", saltBytes)
      }
    ],
    otherActions: 0,
    offers: 0
  }

  const submissions = new ReportSubmissions({
    categories,
    generations,
    reports,
    inspector,
    chain,
    payer,
    metrics: reportMetrics,
    logger,
    minimumHolders
  })

  const server = buildHttpServer({
    service: "seal",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger
  })

  registerFiledReportRoutes(server, {
    submissions,
    rateLimiter: new KeyedIpRateLimiter(ipLimitMax, 60, new Uint8Array(32).fill(8)),
    reportMetrics,
    metrics
  })

  return { server, generations, reports, inspector, chain, payer, logger }
}

const openServers: FastifyInstance[] = []

afterEach(async () => {
  while (openServers.length > 0) {
    const server = openServers.pop()

    if (server !== undefined) {
      await server.close()
    }
  }
})

describe("filed report HTTP routes", () => {
  it("lists active categories, accepts valid submissions with 202, and reports status by nullifier", async () => {
    const { server, logger } = createHarness()

    openServers.push(server)

    const categoryResponse = await server.inject({ method: "GET", url: "/api/v1/seal/report-categories" })

    assert.equal(categoryResponse.statusCode, 200)
    assert.deepEqual(
      categoryResponse.json<{ categories: { slug: string }[] }>().categories.map((item) => item.slug),
      ["counterfeit", "fraud", "abuse"]
    )

    const submitResponse = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      headers: { "x-forwarded-for": "198.51.100.42" },
      payload: {
        transaction: validTxBase64,
        category: "fraud",
        body: "damaged box with missing seal",
        salt: saltHex
      }
    })

    assert.equal(submitResponse.statusCode, 202)
    assert.deepEqual(submitResponse.json(), {
      nullifier: nullifierHex,
      txId: "00sp1",
      status: "submitted"
    })

    const statusResponse = await server.inject({ method: "GET", url: `/api/v1/seal/reports/${nullifierHex}` })

    assert.equal(statusResponse.statusCode, 200)
    assert.equal(statusResponse.json<{ status: string; generation: number }>().status, "submitted")
    assert.equal(statusResponse.json<{ status: string; generation: number }>().generation, 1)

    assert.equal(JSON.stringify(logger.lines).includes("198.51.100.42"), false)
    assert.equal(JSON.stringify(logger.lines).includes("damaged box with missing seal"), false)
  })

  it("rate limits per hashed client IP and isolates different clients", async () => {
    const { server } = createHarness(20, 1)

    openServers.push(server)

    const first = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      headers: { "x-forwarded-for": "203.0.113.5" },
      payload: { transaction: validTxBase64, category: "unknown", body: "x", salt: saltHex }
    })

    assert.equal(first.statusCode, 400)

    const blocked = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      headers: { "x-forwarded-for": "203.0.113.5" },
      payload: { transaction: validTxBase64, category: "unknown", body: "x", salt: saltHex }
    })

    assert.equal(blocked.statusCode, 429)
    assert.equal(blocked.json<{ error: string }>().error, "RATE_LIMITED")

    const otherIp = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      headers: { "x-forwarded-for": "203.0.113.6" },
      payload: { transaction: validTxBase64, category: "unknown", body: "x", salt: saltHex }
    })

    assert.equal(otherIp.statusCode, 400)
  })

  it("maps validation, crowd, sponsor, and missing-report errors to exact HTTP codes", async () => {
    const { server, reports, payer, logger } = createHarness(20, 20)

    openServers.push(server)

    const badBase64 = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      payload: { transaction: "not-base64!", category: "fraud", body: "evidence", salt: saltHex }
    })

    assert.equal(badBase64.statusCode, 400)
    assert.equal(badBase64.json<{ error: string }>().error, "INVALID_REQUEST")

    const mismatch = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      payload: { transaction: validTxBase64, category: "fraud", body: "wrong body", salt: saltHex }
    })

    assert.equal(mismatch.statusCode, 422)
    assert.equal(mismatch.json<{ error: string }>().error, "DIGEST_MISMATCH")

    reports.setHolders(1, merchantTagHex, 682n, 3)

    const smallCrowd = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      payload: {
        transaction: validTxBase64,
        category: "fraud",
        body: "damaged box with missing seal",
        salt: saltHex
      }
    })

    assert.equal(smallCrowd.statusCode, 409)
    assert.equal(smallCrowd.json<{ error: string }>().error, "CROWD_TOO_SMALL")

    reports.setHolders(1, merchantTagHex, 682n, 20)
    payer.failure = new Error("sponsor unreachable")

    const sponsorDown = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reports",
      headers: { "x-forwarded-for": "198.51.100.77" },
      payload: {
        transaction: validTxBase64,
        category: "fraud",
        body: "damaged box with missing seal",
        salt: saltHex
      }
    })

    assert.equal(sponsorDown.statusCode, 503)
    assert.equal(sponsorDown.json<{ error: string }>().error, "SPONSOR_UNAVAILABLE")
    assert.equal(JSON.stringify(logger.lines).includes("198.51.100.77"), false)

    const missing = await server.inject({ method: "GET", url: `/api/v1/seal/reports/${"00".repeat(32)}` })

    assert.equal(missing.statusCode, 404)
    assert.equal(missing.json<{ error: string }>().error, "REPORT_NOT_FOUND")
  })
})
