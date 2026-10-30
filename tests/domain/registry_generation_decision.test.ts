import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { confirmedAnchor, decideRegistryGeneration } from "../../src/domain/registry_generation_decision.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const digest = "b".repeat(64)

describe("deciding the registry generation", () => {
  it("deploys the first generation", () => {
    assert.deepEqual(decideRegistryGeneration([], digest, undefined), { action: "deploy", retire: [] })
  })

  it("keeps an active generation whose anchor block is unchanged", () => {
    assert.deepEqual(decideRegistryGeneration([registryGeneration({})], digest, "unchanged"), {
      action: "keep",
      retire: []
    })
  })

  it("waits when the chain cannot be read, and never redeploys on an unknown", () => {
    assert.deepEqual(decideRegistryGeneration([registryGeneration({})], digest, "unknown"), {
      action: "wait",
      retire: []
    })
  })

  it("replaces a generation whose chain was reset", () => {
    assert.deepEqual(decideRegistryGeneration([registryGeneration({ generation: 3 })], digest, "replaced"), {
      action: "deploy",
      retire: [{ generation: 3, reason: "chain_reset" }]
    })
  })

  it("replaces a generation built from another contract, whatever the chain says", () => {
    assert.deepEqual(
      decideRegistryGeneration([registryGeneration({ generation: 2, buildDigest: "a".repeat(64) })], digest, undefined),
      { action: "deploy", retire: [{ generation: 2, reason: "contract_rebuilt" }] }
    )
  })

  it("retires a deploy that never finished and deploys again", () => {
    assert.deepEqual(
      decideRegistryGeneration([registryGeneration({ generation: 4, status: "deploying" })], digest, undefined),
      { action: "deploy", retire: [{ generation: 4, reason: "interrupted" }] }
    )
  })

  it("believes a reset only when two observations in a row say so", () => {
    assert.equal(confirmedAnchor(undefined, "replaced"), "unknown")
    assert.equal(confirmedAnchor("unchanged", "replaced"), "unknown")
    assert.equal(confirmedAnchor("unknown", "replaced"), "unknown")
    assert.equal(confirmedAnchor("replaced", "replaced"), "replaced")
    assert.equal(confirmedAnchor("replaced", "unchanged"), "unchanged")
  })
})
