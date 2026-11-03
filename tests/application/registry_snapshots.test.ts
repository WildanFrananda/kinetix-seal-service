import assert from "node:assert/strict"
import { describe, it } from "node:test"

import RegistrySnapshots from "../../src/application/registry_snapshots.service.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeRegistrySnapshotSource from "../fakes/fake_registry_snapshot_source.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

function snapshotsWith(
  generations: RegistryGeneration[] = [registryGeneration({ generation: 2, contractAddress: "02cc" })]
) {
  const source = new FakeRegistrySnapshotSource()
  const clock = { at: new Date("2026-11-03T03:00:00Z") }
  const snapshots = new RegistrySnapshots(
    source,
    new FakeRegistryGenerationStore(generations),
    60,
    function now(): Date {
      return clock.at
    }
  )

  return { source, clock, snapshots }
}

describe("registry snapshots", () => {
  it("reads the active registry once a minute, however often it is asked", async () => {
    const { source, clock, snapshots } = snapshotsWith()

    const first = await snapshots.current()

    await Promise.all([snapshots.current(), snapshots.current()])
    clock.at = new Date(clock.at.getTime() + 59_000)
    await snapshots.current()

    assert.equal(first?.generation, 2)
    assert.deepEqual(source.asked, ["02cc"])

    clock.at = new Date(clock.at.getTime() + 1_000)
    await snapshots.current()

    assert.equal(source.asked.length, 2)
  })

  it("shares one read among requests that arrive together", async () => {
    const { source, snapshots } = snapshotsWith()

    await Promise.all([snapshots.current(), snapshots.current(), snapshots.current()])

    assert.equal(source.asked.length, 1)
  })

  it("has none while no registry is active, and passes a failed read on", async () => {
    assert.equal(await snapshotsWith([registryGeneration({ status: "deploying" })]).snapshots.current(), undefined)

    const { source, snapshots } = snapshotsWith()

    source.fails = new Error("the indexer timed out")

    await assert.rejects(snapshots.current(), /timed out/)
  })
})
