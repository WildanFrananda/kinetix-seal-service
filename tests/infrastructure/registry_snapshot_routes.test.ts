import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import Readiness from "../../src/application/readiness.service.ts"
import RegistrySnapshots from "../../src/application/registry_snapshots.service.ts"
import { buildHttpServer } from "../../src/infrastructure/http/http_server.ts"
import { registerRegistrySnapshotRoutes } from "../../src/infrastructure/http/registry_snapshot_routes.ts"
import { estateMetrics } from "../../src/infrastructure/observability/estate_metrics.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeRegistrySnapshotSource from "../fakes/fake_registry_snapshot_source.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const route = "/api/v1/seal/registry/snapshot"

function surface(generations: RegistryGeneration[] = [registryGeneration({ generation: 2, contractAddress: "02cc" })]) {
  const registry = new Registry()
  const metrics = estateMetrics(registry, "kinetix-seal-service", "0123abc")
  const source = new FakeRegistrySnapshotSource()
  const logger = new RecordingLogger()
  const server = buildHttpServer({
    service: "kinetix-seal-service",
    readiness: new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")),
    registry,
    metrics,
    logger
  })

  registerRegistrySnapshotRoutes(server, {
    snapshots: new RegistrySnapshots(source, new FakeRegistryGenerationStore(generations), 60, function now(): Date {
      return new Date("2026-11-03T03:00:00Z")
    }),
    logger,
    metrics
  })

  return { server, source, logger }
}

describe("the registry snapshot", () => {
  it("gives anyone the active registry's state in hex, cacheable for a minute", async () => {
    const response = await surface().server.inject({ url: route })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers["cache-control"], "public, max-age=60")
    assert.deepEqual(response.json(), {
      generation: 2,
      networkId: "preprod",
      contractAddress: "02cc",
      contractState: "0101",
      zswapChainState: "02",
      ledgerParameters: "03",
      readAt: "2026-11-03T03:00:00.000Z"
    })
  })

  it("answers 503 while no registry is active", async () => {
    const response = await surface([registryGeneration({ status: "deploying" })]).server.inject({ url: route })

    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error, "REGISTRY_UNAVAILABLE")
    assert.equal(response.headers["retry-after"], "60")
  })

  it("answers 503 and logs why when the registry cannot be read", async () => {
    const { server, source, logger } = surface()

    source.fails = new Error("the indexer timed out")

    const response = await server.inject({ url: route })

    assert.equal(response.statusCode, 503)
    assert.match(String(logger.lines.at(-1)?.fields?.cause), /timed out/)
  })
})
