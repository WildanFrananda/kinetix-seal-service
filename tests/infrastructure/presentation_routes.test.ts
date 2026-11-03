import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import PresentationRelay from "../../src/application/presentation_relay.service.ts"
import Readiness from "../../src/application/readiness.service.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { registerPresentationRoutes } from "../../src/infrastructure/http/presentation_routes.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakePresentationInspector from "../fakes/fake_presentation_inspector.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingPresentationMetrics from "../fakes/recording_presentation_metrics.ts"
import RecordingTransactionPayer from "../fakes/recording_transaction_payer.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const route = "/api/v1/seal/presentations"

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const inspector = new FakePresentationInspector()
  const payer = new RecordingTransactionPayer()
  const logger = new RecordingLogger()
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger
  })

  registerPresentationRoutes(server, {
    relay: new PresentationRelay({
      inspector,
      payer,
      generations: new FakeRegistryGenerationStore([registryGeneration({ contractAddress: "02cc" })]),
      metrics: new RecordingPresentationMetrics()
    }),
    logger,
    metrics
  })

  return { server, inspector, payer, logger }
}

function relayed(server: ReturnType<typeof surface>["server"], payload: unknown) {
  return server.inject({ method: "POST", url: route, payload: payload as Record<string, unknown> })
}

describe("the presentation relay route", () => {
  it("takes a verifier's relay without a token and answers 202 with the transaction id", async () => {
    const { server, payer } = surface()
    const response = await relayed(server, { transaction: "0a0b0c" })

    assert.equal(response.statusCode, 202)
    assert.deepEqual(response.json(), { txId: "00sp1" })
    assert.deepEqual([...(payer.sponsored[0] ?? [])], [10, 11, 12])
  })

  it("refuses a body that is not one hex transaction", async () => {
    const { server, payer } = surface()

    for (const payload of [{ transaction: "0A" }, { transaction: "abc" }, { transaction: "" }, { tx: "00" }, ["00"]]) {
      assert.equal((await relayed(server, payload)).statusCode, 400, JSON.stringify(payload))
    }

    assert.equal(payer.sponsored.length, 0)
  })

  it("answers 422 for a transaction that is not a presentation", async () => {
    const { server, inspector } = surface()

    inspector.next = { calls: [{ address: "02cc", entryPoint: "issue" }], otherActions: 0, offers: 0 }

    const response = await relayed(server, { transaction: "00" })

    assert.equal(response.statusCode, 422)
    assert.equal(response.json().message, "the call is not present")
  })

  it("answers 503 when the sponsor cannot take it, and logs no address", async () => {
    const { server, payer, logger } = surface()

    payer.failure = new Error("the sponsor did not answer")

    const response = await relayed(server, { transaction: "00" })

    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error, "SPONSOR_UNAVAILABLE")
    assert.equal(response.headers["retry-after"], "30")
    assert.doesNotMatch(JSON.stringify(logger.lines), /127\.0\.0\.1|remoteAddress|x-forwarded-for/i)
  })

  it("refuses a body over 16 KiB", async () => {
    const { server } = surface()

    assert.equal((await relayed(server, { transaction: "00".repeat(9_000) })).statusCode, 413)
  })
})
