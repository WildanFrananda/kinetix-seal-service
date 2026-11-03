import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import Readiness from "../../src/application/readiness.service.ts"
import HolderAssets from "../../src/infrastructure/http/holder_assets.ts"
import { registerHolderRoutes } from "../../src/infrastructure/http/holder_routes.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

const digest = "a".repeat(64)

function holderDirectory(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "seal-holder-"))

  mkdirSync(join(root, digest))
  writeFileSync(join(root, "current.json"), JSON.stringify({ digest }))

  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(root, digest, name), contents)
  }

  return root
}

function surface() {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger: new RecordingLogger()
  })

  registerHolderRoutes(server, {
    assets: HolderAssets.load(holderDirectory({ "index.html": "<!doctype html>", "holder.js": "1", "x.wasm": "w" })),
    metrics
  })

  return server
}

describe("the holder's files", () => {
  it("names the current build, which the app reloads when it changes", async () => {
    const response = await surface().inject({ url: "/api/v1/seal/holder" })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers["cache-control"], "no-cache")
    assert.deepEqual(response.json(), {
      digest,
      entry: `/api/v1/seal/holder/${digest}/index.html`,
      notices: `/api/v1/seal/holder/${digest}/THIRD_PARTY_NOTICES.txt`
    })
  })

  it("serves each file forever under its build, the page with a strict policy", async () => {
    const server = surface()
    const page = await server.inject({ url: `/api/v1/seal/holder/${digest}/index.html` })
    const wasm = await server.inject({ url: `/api/v1/seal/holder/${digest}/x.wasm` })

    assert.equal(page.headers["cache-control"], "public, max-age=31536000, immutable")
    assert.match(String(page.headers["content-security-policy"]), /script-src 'self' 'wasm-unsafe-eval'/)
    assert.equal(wasm.headers["content-type"], "application/wasm")
    assert.equal(wasm.headers["x-content-type-options"], "nosniff")
    assert.equal(wasm.headers["content-security-policy"], undefined)
  })

  it("answers 404 for another build, a missing file and a path outside the build", async () => {
    const server = surface()

    for (const url of [
      `/api/v1/seal/holder/${"b".repeat(64)}/index.html`,
      `/api/v1/seal/holder/${digest}/missing.js`,
      `/api/v1/seal/holder/${digest}/..%2Fcurrent.json`
    ]) {
      assert.equal((await server.inject({ url })).statusCode, 404, url)
    }
  })

  it("refuses to start without a page or a script", () => {
    assert.throws(() => HolderAssets.load(holderDirectory({ "index.html": "x" })), /no page or no script/)
  })
})
