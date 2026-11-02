import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import CourierCredentials from "../../src/application/courier_credentials.service.ts"
import Readiness from "../../src/application/readiness.service.ts"
import { registerCredentialRoutes } from "../../src/infrastructure/http/credential_routes.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeCourierFactReader from "../fakes/fake_courier_fact_reader.ts"
import FakeCredentialStore from "../fakes/fake_credential_store.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import FixedTokenVerifier from "../fakes/fixed_token_verifier.ts"
import RecordingCredentialMetrics from "../fakes/recording_credential_metrics.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-02T03:00:00Z")
const route = "/api/v1/seal/courier-credentials"
const courierToken = "Bearer courier-token"
const sellerToken = "Bearer seller-token"
const otherCourierToken = "Bearer other-courier-token"
const holderPublicKey = "987654321"

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const facts = new FakeCourierFactReader(new Date(at.getTime() - 60_000))
  const store = new FakeCredentialStore()
  const generations = new FakeRegistryGenerationStore([registryGeneration({ generation: 1, contractAddress: "02cc" })])
  const tokens = new FixedTokenVerifier()
  const logger = new RecordingLogger()
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
  facts.summaries.set("drv_1", {
    deliveries: 3,
    firstDeliveredAt: new Date("2026-10-30T00:00:00Z"),
    reviews: 1,
    ratingSum: 5
  })

  registerCredentialRoutes(server, {
    credentials: new CourierCredentials(facts, store, generations, new RecordingCredentialMetrics(), 300),
    tokens,
    logger,
    metrics,
    clock: function now(): Date {
      return at
    }
  })

  return { server, store, facts, tokens, registry, logger }
}

async function requested(
  http: ReturnType<typeof surface>["server"],
  authorization = courierToken,
  body: unknown = { holderPublicKey }
) {
  return http.inject({
    method: "POST",
    url: route,
    headers: { authorization },
    payload: body as Record<string, unknown>
  })
}

describe("the courier credential routes", () => {
  it("accepts a courier's request with 202 and where to follow it", async () => {
    const { server } = surface()
    const response = await requested(server)
    const body = response.json()

    assert.equal(response.statusCode, 202)
    assert.equal(response.headers.location, `${route}/${body.id}`)
    assert.equal(response.headers["cache-control"], "no-store")
    assert.equal(body.status, "pending")
    assert.deepEqual(body.credential.attributes, ["3", "500", "3", "20759"])
    assert.equal(body.credential.salt.length, 64)
    assert.equal(body.holderPublicKey, holderPublicKey)
    assert.equal(body.registry, null)
  })

  it("shows the credential to its holder with where it was issued", async () => {
    const { server, store } = surface()
    const { id } = (await requested(server)).json()

    await store.queueCurrent(1)
    await store.markIssued(id, 1, 7n, "00tx")

    const response = await server.inject({ url: `${route}/${id}`, headers: { authorization: courierToken } })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().registry, { generation: 1, contractAddress: "02cc", leafIndex: "7", txId: "00tx" })
  })

  it("answers a repeat with 200 and the same credential", async () => {
    const { server } = surface()
    const first = (await requested(server)).json()
    const again = await requested(server)

    assert.equal(again.statusCode, 200)
    assert.equal(again.json().id, first.id)
  })

  it("hides a credential from anyone but its holder, and an id that is not one", async () => {
    const { server } = surface()
    const { id } = (await requested(server)).json()

    for (const url of [`${route}/${id}`, `${route}/not-a-uuid`, `${route}/${id.toUpperCase()}`]) {
      const response = await server.inject({ url, headers: { authorization: otherCourierToken } })

      assert.equal(response.statusCode, 404, url)
      assert.equal(response.json().error, "NOT_FOUND")
    }
  })

  it("refuses a missing or bad token with 401, and says so when identity cannot be asked", async () => {
    const { server, tokens, logger } = surface()

    assert.equal((await requested(server, "Bearer nobody")).statusCode, 401)
    assert.equal((await requested(server, "Bearer nobody")).headers["www-authenticate"], "Bearer")

    tokens.verdicts.set("Bearer while-identity-is-down", { kind: "unavailable", reason: "fetch failed" })

    const response = await requested(server, "Bearer while-identity-is-down")

    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error, "IDENTITY_UNAVAILABLE")
    assert.ok(logger.lines.some((line) => line.message === "identity's signing keys could not be read"))
  })

  it("refuses a body that is not exactly a holder key in decimal", async () => {
    const { server } = surface()

    for (const body of [
      {},
      { holderPublicKey: 123 },
      { holderPublicKey: "0x10" },
      { holderPublicKey, extra: true },
      [holderPublicKey]
    ]) {
      const response = await requested(server, courierToken, body)

      assert.equal(response.statusCode, 400, JSON.stringify(body))
      assert.equal(response.json().error, "INVALID_REQUEST")
    }
  })

  it("refuses a body that is not JSON, or too large, as the client's error", async () => {
    const { server } = surface()
    const form = await server.inject({
      method: "POST",
      url: route,
      headers: { authorization: courierToken, "content-type": "application/x-www-form-urlencoded" },
      payload: `holderPublicKey=${holderPublicKey}`
    })

    const text = await server.inject({
      method: "POST",
      url: route,
      headers: { authorization: courierToken, "content-type": "text/plain" },
      payload: holderPublicKey
    })

    const large = await requested(server, courierToken, { holderPublicKey: "1".repeat(2000) })
    const broken = await server.inject({
      method: "POST",
      url: route,
      headers: { authorization: courierToken, "content-type": "application/json" },
      payload: "{"
    })

    assert.equal(form.statusCode, 415)
    assert.equal(form.json().error, "JSON_REQUIRED")
    assert.equal(text.statusCode, 400)
    assert.equal(large.statusCode, 413)
    assert.equal(broken.statusCode, 400)
  })

  it("answers each refusal with its own code", async () => {
    const { server, facts } = surface()

    assert.equal((await requested(server, sellerToken)).json().error, "COURIER_REQUIRED")
    assert.equal((await requested(server, otherCourierToken)).json().error, "NO_DELIVERIES")

    await requested(server)

    const taken = await requested(server, courierToken, { holderPublicKey: "1" })

    assert.equal(taken.statusCode, 409)
    assert.equal(taken.json().error, "ISSUED_TODAY")

    facts.caughtUp = { deliveries: undefined, reviews: at }

    const stale = await requested(server, otherCourierToken)

    assert.equal(stale.statusCode, 503)
    assert.equal(stale.headers["retry-after"], "60")
    assert.equal(stale.json().error, "FACTS_UNAVAILABLE")
  })

  it("labels both routes by template in the metrics", async () => {
    const { server } = surface()

    await server.inject({
      url: `${route}/00000000-0000-4000-8000-000000000001`,
      headers: { authorization: courierToken }
    })

    const body = (await server.inject({ url: "/metrics" })).body

    assert.ok(body.includes('route="/api/v1/seal/courier-credentials"'))
    assert.ok(body.includes('route="/api/v1/seal/courier-credentials/{id}"'))
    assert.ok(!body.includes("00000000-0000-4000-8000-000000000001"))
  })
})
