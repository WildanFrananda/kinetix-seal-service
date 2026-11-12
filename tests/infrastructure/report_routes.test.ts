import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import Readiness from "../../src/application/readiness.service.ts"
import ReportRights from "../../src/application/report_rights.service.ts"
import ReporterRegistry from "../../src/application/reporter_registry.service.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { registerReportRoutes } from "../../src/infrastructure/http/report_routes.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeReportChain from "../fakes/fake_report_chain.ts"
import FakeReportRightStore from "../fakes/fake_report_right_store.ts"
import FakeReporterStore from "../fakes/fake_reporter_store.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import FixedTokenVerifier from "../fakes/fixed_token_verifier.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingReportMetrics from "../fakes/recording_report_metrics.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-12T05:00:00Z")
const courierToken = "Bearer courier-token"
const sellerToken = "Bearer seller-token"
const otherCourierToken = "Bearer other-courier-token"

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const tokens = new FixedTokenVerifier()
  const logger = new RecordingLogger()
  const rightStore = new FakeReportRightStore()
  const reportMetrics = new RecordingReportMetrics()
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger
  })

  tokens.verdicts.set(courierToken, { kind: "principal", principal: { principalId: "drv_1", role: "courier" } })
  tokens.verdicts.set(sellerToken, { kind: "principal", principal: { principalId: "sel_1", role: "seller" } })
  tokens.verdicts.set(otherCourierToken, { kind: "principal", principal: { principalId: "drv_2", role: "courier" } })
  rightStore.held.set("drv_1", [
    {
      id: "0b0e7f6e-1b7a-4c5e-9c1e-1f2a3b4c5d6e",
      role: "courier",
      orderNumber: "ORD-20261108-8AA3A287",
      reporterKey: 11n,
      merchantTag: new Uint8Array(32).fill(5),
      window: 682,
      deliveredAt: new Date("2026-11-08T10:00:00Z"),
      leafIndex: 3n,
      crowd: 1
    }
  ])

  registerReportRoutes(server, {
    reporters: new ReporterRegistry(new FakeReporterStore(), reportMetrics),
    rights: new ReportRights(
      rightStore,
      new FakeReportChain(),
      new FakeRegistryGenerationStore([registryGeneration({ generation: 1, contractAddress: "03aa" })]),
      reportMetrics,
      function now(): Date {
        return at
      },
      50
    ),
    tokens,
    logger,
    metrics,
    clock: function now(): Date {
      return at
    }
  })

  return server
}

describe("the reporter routes", () => {
  it("register a courier's reporter key once, and answer a repeat with the same registration", async () => {
    const server = surface()
    const body = { reporterKey: "987654321" }
    const first = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: courierToken },
      payload: body
    })

    const again = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: courierToken },
      payload: body
    })

    assert.equal(first.statusCode, 201)
    assert.equal(first.json().role, "courier")
    assert.equal(first.json().reporterKey, "987654321")
    assert.equal(first.headers["cache-control"], "no-store")
    assert.equal(again.statusCode, 200)
    assert.equal(again.json().id, first.json().id)
  })

  it("refuse a key another account holds, a seller, a body with more than the key, and no token", async () => {
    const server = surface()

    await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: courierToken },
      payload: { reporterKey: "987654321" }
    })

    const taken = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: otherCourierToken },
      payload: { reporterKey: "987654321" }
    })

    const seller = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: sellerToken },
      payload: { reporterKey: "5" }
    })

    const extra = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      headers: { authorization: courierToken },
      payload: { reporterKey: "5", principal: "drv_9" }
    })

    const anonymous = await server.inject({
      method: "POST",
      url: "/api/v1/seal/reporters",
      payload: { reporterKey: "5" }
    })

    assert.equal(taken.statusCode, 409)
    assert.equal(taken.json().error, "REPORTER_KEY_TAKEN")
    assert.equal(seller.statusCode, 403)
    assert.equal(seller.json().error, "REPORTER_ROLE_REQUIRED")
    assert.equal(extra.statusCode, 400)
    assert.equal(anonymous.statusCode, 401)
  })

  it("list the caller's own rights with the order bytes, the index and the crowd", async () => {
    const server = surface()
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/seal/report-rights",
      headers: { authorization: courierToken }
    })

    const listing = response.json()

    assert.equal(response.statusCode, 200)
    assert.deepEqual(listing.registry, { generation: 1, contractAddress: "03aa" })
    assert.equal(listing.rights.length, 1)
    assert.equal(listing.rights[0].status, "granted")
    assert.equal(listing.rights[0].leafIndex, "3")
    assert.equal(listing.rights[0].crowd, 1)
    assert.equal(listing.rights[0].reporterKey, "11")
    assert.equal(listing.rights[0].order.length, 64)
    assert.ok(listing.rights[0].order.startsWith(Buffer.from("ORD-20261108-8AA3A287").toString("hex")))

    const other = await server.inject({
      method: "GET",
      url: "/api/v1/seal/report-rights",
      headers: { authorization: otherCourierToken }
    })

    assert.deepEqual(other.json().rights, [])
  })
})
