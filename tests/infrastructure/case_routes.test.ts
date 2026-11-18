import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import CaseCatalogue from "../../src/application/case_catalogue.service.ts"
import Readiness from "../../src/application/readiness.service.ts"
import { hexOf } from "../../src/domain/hex.ts"
import { merchantTagOf } from "../../src/domain/merchant_tag.ts"
import { registerCaseRoutes } from "../../src/infrastructure/http/case_routes.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeCaseStore from "../fakes/fake_case_store.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakeMerchantInfo from "../fakes/fake_merchant_info.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import FixedTokenVerifier from "../fakes/fixed_token_verifier.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

const issuerSecret = new Uint8Array(32).fill(0x4c)
const route = "/api/v1/seal/cases"
const adminToken = "Bearer admin-token"
const courierToken = "Bearer courier-token"
const merchantId = "4b5c6d7e-8f90-4a1b-9c2d-3e4f5a6b7c8d"

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const cases = new FakeCaseStore()
  const merchants = new FakeMerchantInfo()
  const tokens = new FixedTokenVerifier()
  const logger = new RecordingLogger()
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger
  })

  tokens.verdicts.set(adminToken, { kind: "principal", principal: { principalId: "adm_1", role: "admin" } })
  tokens.verdicts.set(courierToken, { kind: "principal", principal: { principalId: "drv_1", role: "courier" } })

  registerCaseRoutes(server, {
    cases: new CaseCatalogue({ cases, merchants, issuerSecret }),
    tokens,
    logger,
    metrics
  })

  return { server, cases, merchants, tokens }
}

describe("the case routes", () => {
  it("lists merchant cases for an admin with no-store caching", async () => {
    const { server, cases, merchants } = surface()
    const merchantTag = hexOf(merchantTagOf(issuerSecret, merchantId))

    cases.tags.set(merchantTag, merchantId)
    merchants.profiles.set(merchantId, { storeName: "Toko Amanah", status: "verified" })
    cases.details.set(merchantTag, {
      merchantTag,
      confirmedCount: 2,
      pendingCount: 1,
      totalCount: 3,
      windowCount: 1,
      earliestWindow: 202611,
      latestWindow: 202611,
      firstReportedAt: new Date("2026-11-01T10:00:00Z"),
      latestReportedAt: new Date("2026-11-05T12:00:00Z"),
      categories: [{ slug: "counterfeit", label: "Counterfeit goods", count: 3 }],
      reports: [
        {
          nullifier: "cc".repeat(32),
          category: { slug: "counterfeit", label: "Counterfeit goods" },
          body: "seal was broken before arrival",
          window: 202611,
          status: "confirmed",
          firstGeneration: 1,
          txId: "tx-confirmed",
          submittedAt: new Date("2026-11-05T12:00:00Z"),
          confirmedAt: new Date("2026-11-05T12:03:00Z")
        },
        {
          nullifier: "dd".repeat(32),
          category: { slug: "counterfeit", label: "Counterfeit goods" },
          body: "different serial printed on tag",
          window: 202611,
          status: "submitted",
          firstGeneration: 1,
          txId: "tx-pending",
          submittedAt: new Date("2026-11-01T10:00:00Z"),
          confirmedAt: undefined
        }
      ]
    })

    const listed = await server.inject({ method: "GET", url: route, headers: { authorization: adminToken } })

    assert.equal(listed.statusCode, 200)
    assert.equal(listed.headers["cache-control"], "no-store")
    assert.equal(listed.json().cases.length, 1)
    assert.equal(listed.json().cases[0].merchant.storeName, "Toko Amanah")
    assert.equal(listed.json().cases[0].confirmedCount, 2)
    assert.equal(listed.json().cases[0].pendingCount, 1)

    const detail = await server.inject({
      method: "GET",
      url: `${route}/${merchantId}?status=confirmed`,
      headers: { authorization: adminToken }
    })

    assert.equal(detail.statusCode, 200)
    assert.equal(detail.headers["cache-control"], "no-store")
    assert.equal(detail.json().reports.length, 1)
    assert.equal(detail.json().reports[0].txId, "tx-confirmed")
  })

  it("refuses unauthenticated, non-admin, bad status filters, and missing cases", async () => {
    const { server } = surface()

    const unauthenticated = await server.inject({ method: "GET", url: route })
    const forbidden = await server.inject({ method: "GET", url: route, headers: { authorization: courierToken } })
    const invalidFilter = await server.inject({
      method: "GET",
      url: `${route}?status=bogus`,
      headers: { authorization: adminToken }
    })

    const nonUuid = await server.inject({
      method: "GET",
      url: `${route}/mer_1`,
      headers: { authorization: adminToken }
    })

    const notFound = await server.inject({
      method: "GET",
      url: `${route}/${merchantId}`,
      headers: { authorization: adminToken }
    })

    assert.equal(unauthenticated.statusCode, 401)
    assert.equal(forbidden.statusCode, 403)
    assert.equal(forbidden.json().error, "ADMIN_REQUIRED")
    assert.equal(invalidFilter.statusCode, 400)
    assert.equal(invalidFilter.json().error, "INVALID_REQUEST")
    assert.equal(nonUuid.statusCode, 404)
    assert.equal(notFound.statusCode, 404)
    assert.equal(notFound.json().error, "CASE_NOT_FOUND")
  })

  it("opens opaque non-UUID merchant principal IDs returned by the list", async () => {
    const { server, cases, merchants } = surface()
    const opaqueId = "mer_1"
    const tag = hexOf(merchantTagOf(issuerSecret, opaqueId))

    cases.tags.set(tag, opaqueId)
    merchants.profiles.set(opaqueId, { storeName: "Warung Pojok", status: "verified" })
    cases.details.set(tag, {
      merchantTag: tag,
      confirmedCount: 1,
      pendingCount: 0,
      totalCount: 1,
      windowCount: 1,
      earliestWindow: 202611,
      latestWindow: 202611,
      firstReportedAt: new Date("2026-11-05T12:00:00Z"),
      latestReportedAt: new Date("2026-11-05T12:00:00Z"),
      categories: [{ slug: "fraud", label: "Fraud or misrepresentation", count: 1 }],
      reports: []
    })

    const detail = await server.inject({
      method: "GET",
      url: `${route}/${opaqueId}`,
      headers: { authorization: adminToken }
    })

    assert.equal(detail.statusCode, 200)
    assert.equal(detail.json().merchantPrincipalId, opaqueId)
    assert.equal(detail.json().merchant.storeName, "Warung Pojok")
  })
})
