import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import Readiness from "../../src/application/readiness.service.ts"
import BundleAssets from "../../src/infrastructure/http/bundle_assets.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { registerVerifierRoutes } from "../../src/infrastructure/http/verifier_routes.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

const digest = "e".repeat(64)

function surface() {
  const root = mkdtempSync(join(tmpdir(), "seal-verifier-"))

  mkdirSync(join(root, digest))
  writeFileSync(join(root, "current.json"), JSON.stringify({ digest }))
  writeFileSync(join(root, digest, "verifier.js"), "1")
  writeFileSync(join(root, digest, "verifier.css"), "body{}")

  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger: new RecordingLogger()
  })

  registerVerifierRoutes(server, { assets: BundleAssets.load(root, ["verifier.js", "verifier.css"]), metrics })

  return server
}

describe("the verifier page", () => {
  it("is one page on seal's own origin, its script and style pinned to the current build", async () => {
    const response = await surface().inject({ url: "/api/v1/seal/verify" })

    assert.equal(response.statusCode, 200)
    assert.match(String(response.headers["content-type"]), /text\/html/)
    assert.equal(response.headers["cache-control"], "no-cache")
    assert.match(response.body, new RegExp(`/api/v1/seal/verify/assets/${digest}/verifier\\.js`))
    assert.match(String(response.headers["content-security-policy"]), /script-src 'self';.*connect-src 'self'/)
    assert.equal(response.headers["permissions-policy"], "camera=(self), microphone=(), geolocation=()")
    assert.equal(response.headers["referrer-policy"], "no-referrer")
  })

  it("serves its build forever and nothing else", async () => {
    const server = surface()
    const style = await server.inject({ url: `/api/v1/seal/verify/assets/${digest}/verifier.css` })

    assert.equal(style.headers["content-type"], "text/css; charset=utf-8")
    assert.equal(style.headers["cache-control"], "public, max-age=31536000, immutable")
    assert.equal((await server.inject({ url: `/api/v1/seal/verify/assets/${digest}/other.js` })).statusCode, 404)
    assert.equal(
      (await server.inject({ url: `/api/v1/seal/verify/assets/${"f".repeat(64)}/verifier.js` })).statusCode,
      404
    )
  })
})
