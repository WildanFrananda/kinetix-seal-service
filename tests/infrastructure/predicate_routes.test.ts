import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import PredicateCatalogue from "../../src/application/predicate_catalogue.service.ts"
import Readiness from "../../src/application/readiness.service.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { registerPredicateRoutes } from "../../src/infrastructure/http/predicate_routes.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakePredicateChain from "../fakes/fake_predicate_chain.ts"
import FakePredicatePlacementStore from "../fakes/fake_predicate_placement_store.ts"
import FakePredicateTemplateStore from "../fakes/fake_predicate_template_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import FixedTokenVerifier from "../fakes/fixed_token_verifier.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-03T03:00:00Z")
const route = "/api/v1/seal/predicates"
const adminToken = "Bearer admin-token"
const courierToken = "Bearer courier-token"
const experienced = {
  class: "courier",
  label: "Experienced courier",
  minimums: { deliveries: 100, ratingHundredths: 450, daysActive: 90 },
  freshnessDays: 30
}

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const templates = new FakePredicateTemplateStore()
  const placements = new FakePredicatePlacementStore()
  const chain = new FakePredicateChain()
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

  registerPredicateRoutes(server, {
    predicates: new PredicateCatalogue({
      chain,
      templates,
      placements,
      generations: new FakeRegistryGenerationStore([registryGeneration({ generation: 2, contractAddress: "02cc" })]),
      logger,
      periodDays: 7
    }),
    tokens,
    logger,
    metrics,
    clock: function now(): Date {
      return at
    }
  })

  return { server, templates, tokens, registry }
}

async function approved(
  http: ReturnType<typeof surface>["server"],
  authorization = adminToken,
  body: unknown = experienced
) {
  return http.inject({
    method: "POST",
    url: route,
    headers: { authorization },
    payload: body as Record<string, unknown>
  })
}

describe("the predicate routes", () => {
  it("lets an admin approve a predicate: 201, where it lives, and its registry rows", async () => {
    const { server } = surface()
    const response = await approved(server)
    const body = response.json()

    assert.equal(response.statusCode, 201)
    assert.equal(response.headers.location, `${route}/${body.id}`)
    assert.equal(response.headers["cache-control"], "no-store")
    assert.equal(body.status, "live")
    assert.equal(body.class, "courier")
    assert.deepEqual(body.minimums, experienced.minimums)
    assert.deepEqual(
      body.rows.map((row: { minimums: string[]; minimumIssueDate: string; current: boolean; placed: boolean }) => [
        row.minimums,
        row.minimumIssueDate,
        row.current,
        row.placed
      ]),
      [
        [["100", "450", "90", "20725"], "2026-09-29", true, false],
        [["100", "450", "90", "20718"], "2026-09-22", false, false]
      ]
    )

    assert.match(body.rows[0].id, /^[0-9a-f]{64}$/)
  })

  it("lists the live predicates to anyone, without a token, cacheable for a minute", async () => {
    const { server } = surface()
    const { id } = (await approved(server)).json()
    const response = await server.inject({ url: route })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers["cache-control"], "public, max-age=60")
    assert.deepEqual(response.json().registry, { generation: 2, contractAddress: "02cc" })
    assert.deepEqual(
      response.json().predicates.map((predicate: { id: string }) => predicate.id),
      [id]
    )

    assert.equal((await server.inject({ url: `${route}/${id}` })).json().label, "Experienced courier")
  })

  it("withdraws with 204, twice alike, and shows the withdrawn one with no rows", async () => {
    const { server } = surface()
    const { id } = (await approved(server)).json()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await server.inject({
        method: "DELETE",
        url: `${route}/${id}`,
        headers: { authorization: adminToken }
      })

      assert.equal(response.statusCode, 204)
    }

    const shown = (await server.inject({ url: `${route}/${id}` })).json()

    assert.equal(shown.status, "withdrawn")
    assert.deepEqual(shown.rows, [])
    assert.deepEqual((await server.inject({ url: route })).json().predicates, [])
  })

  it("is an admin's: a courier gets 403, no token 401", async () => {
    const { server, templates } = surface()

    assert.equal((await approved(server, courierToken)).statusCode, 403)
    assert.equal((await approved(server, courierToken)).json().error, "ADMIN_REQUIRED")
    assert.equal((await approved(server, "Bearer nobody")).statusCode, 401)
    assert.equal(
      (await server.inject({ method: "DELETE", url: `${route}/00000000-0000-4000-8000-0000000000a1` })).statusCode,
      401
    )

    assert.equal(templates.templates.length, 0)
  })

  it("refuses a body that is not exactly a draft within the class's bounds", async () => {
    const { server } = surface()
    const bodies = [
      { ...experienced, extra: true },
      { ...experienced, class: "merchant" },
      { ...experienced, minimums: { deliveries: 100, ratingHundredths: 501, daysActive: 90 } },
      { ...experienced, minimums: { deliveries: 100, ratingHundredths: 450 } },
      { ...experienced, minimums: { deliveries: "100", ratingHundredths: 450, daysActive: 90 } },
      { ...experienced, minimums: { deliveries: 1.5, ratingHundredths: 450, daysActive: 90 } },
      { ...experienced, freshnessDays: 0 },
      { ...experienced, label: "" },
      ["not", "an", "object"]
    ]

    for (const body of bodies) {
      const response = await approved(server, adminToken, body)

      assert.equal(response.statusCode, 400, JSON.stringify(body))
      assert.equal(response.json().error, "INVALID_REQUEST")
    }
  })

  it("answers a duplicate and a full class with 409", async () => {
    const { server } = surface()

    await approved(server)

    assert.equal((await approved(server)).json().error, "PREDICATE_EXISTS")

    for (let index = 1; index < 8; index += 1) {
      await approved(server, adminToken, { ...experienced, minimums: { ...experienced.minimums, deliveries: index } })
    }

    const full = await approved(server, adminToken, { ...experienced, freshnessDays: 7 })

    assert.equal(full.statusCode, 409)
    assert.equal(full.json().error, "TOO_MANY_PREDICATES")
  })

  it("answers 404 for an unknown predicate and an id that is not one", async () => {
    const { server } = surface()

    for (const id of ["00000000-0000-4000-8000-00000000ffff", "not-a-uuid"]) {
      assert.equal((await server.inject({ url: `${route}/${id}` })).statusCode, 404, id)
      assert.equal(
        (await server.inject({ method: "DELETE", url: `${route}/${id}`, headers: { authorization: adminToken } }))
          .statusCode,
        404,
        id
      )
    }
  })

  it("seeds its routes' request counters", async () => {
    const { registry } = surface()
    const exposition = await registry.metrics()

    assert.match(exposition, /method="GET",route="\/api\/v1\/seal\/predicates",status="200"\} 0/)
    assert.match(exposition, /method="DELETE",route="\/api\/v1\/seal\/predicates\/\{id\}",status="204"\} 0/)
  })
})
