import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Registry } from "prom-client"

import PrometheusRegistryGauges from "../../src/infrastructure/observability/prometheus_registry_gauges.adapter.ts"

describe("the registry gauges", () => {
  it("publish both registries from the start, and count each one's deploys apart", async () => {
    const registry = new Registry()
    const gauges = new PrometheusRegistryGauges(registry)

    const before = await registry.metrics()

    assert.match(before, /kinetix_seal_registry_generation\{registry="credential"\} 0/)
    assert.match(before, /kinetix_seal_registry_generation\{registry="report"\} 0/)
    assert.match(before, /kinetix_seal_registry_deploys_total\{registry="report",outcome="failed"\} 0/)

    gauges.of("credential").activeGeneration(49)
    gauges.of("report").deployed("failed")

    const after = await registry.metrics()

    assert.match(after, /kinetix_seal_registry_generation\{registry="credential"\} 49/)
    assert.match(after, /kinetix_seal_registry_generation\{registry="report"\} 0/)
    assert.match(after, /kinetix_seal_registry_deploys_total\{registry="report",outcome="failed"\} 1/)
    assert.match(after, /kinetix_seal_registry_deploys_total\{registry="credential",outcome="failed"\} 0/)
  })
})
