import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Registry } from "prom-client"

import Readiness from "../../src/application/readiness.service.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import PrometheusSponsorGauges from "../../src/infrastructure/observability/prometheus_sponsor_gauges.adapter.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

function server(database: boolean, sponsor: FixedSponsorCondition) {
  const registry = new Registry()

  new PrometheusSponsorGauges(registry)

  return buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(database), sponsor),
    registry,
    metrics: estateMetrics(registry, "kinetix-seal-service", "0123abc"),
    logger: new RecordingLogger()
  })
}

describe("the HTTP surface", () => {
  it("answers liveness without naming its framework, runtime or version", async () => {
    const response = await server(true, new FixedSponsorCondition("healthy")).inject({ url: "/health" })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { status: "ok", service: "kinetix-seal-service" })
    assert.doesNotMatch(response.body, /fastify|node|version|port|mode/i)
  })

  it("is ready with a reachable database and a synced sponsor", async () => {
    const response = await server(true, new FixedSponsorCondition("healthy")).inject({ url: "/health/ready" })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { status: "ready", database: "reachable", sponsor: "healthy" })
  })

  it("answers 503 while the sponsor wallet restores", async () => {
    const response = await server(true, new FixedSponsorCondition("syncing")).inject({ url: "/health/ready" })

    assert.equal(response.statusCode, 503)
    assert.equal(response.json().sponsor, "syncing")
  })

  it("answers 503 without driver text when the database is gone", async () => {
    const response = await server(false, new FixedSponsorCondition("healthy")).inject({ url: "/health/ready" })

    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { status: "unavailable", database: "unreachable", sponsor: "healthy" })
  })

  it("echoes the request id", async () => {
    const response = await server(true, new FixedSponsorCondition("healthy")).inject({
      url: "/health",
      headers: { "x-request-id": "trace-1" }
    })

    assert.equal(response.headers["x-request-id"], "trace-1")
  })

  it("serves the estate's metrics and the sponsor's, with bounded labels", async () => {
    const http = server(true, new FixedSponsorCondition("healthy"))

    await http.inject({ url: "/no/such/123" })

    const response = await http.inject({ url: "/metrics" })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers["cache-control"], "no-store")

    for (const series of [
      "kinetix_http_requests_total",
      "kinetix_http_request_duration_seconds",
      'kinetix_build_info{service="kinetix-seal-service",version="0123abc"} 1',
      "kinetix_seal_sponsor_dust_coins",
      'kinetix_seal_sponsor_condition{condition="syncing"} 1'
    ]) {
      assert.ok(response.body.includes(series), `missing ${series}`)
    }

    assert.ok(response.body.includes('route="unmatched"'))
    assert.ok(!response.body.includes("/no/such/123"))
  })
})
