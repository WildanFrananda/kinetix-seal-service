import assert from "node:assert/strict"
import { describe, it } from "node:test"

import ReportRights from "../../src/application/report_rights.service.ts"
import RightGranter from "../../src/application/right_granter.service.ts"
import { reportWindowOf } from "../../src/domain/report_window.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeReportChain from "../fakes/fake_report_chain.ts"
import FakeReportRightStore from "../fakes/fake_report_right_store.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingReportMetrics from "../fakes/recording_report_metrics.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-12T05:00:00Z")

function now(): Date {
  return at
}

function world(generations = [registryGeneration({ generation: 1, contractAddress: "03aa" })]) {
  const chain = new FakeReportChain()
  const store = new FakeReportRightStore()
  const metrics = new RecordingReportMetrics()
  const logger = new RecordingLogger()
  const generationStore = new FakeRegistryGenerationStore(generations)
  const rights = new ReportRights(store, chain, generationStore, metrics, now, 2)
  const granter = new RightGranter(chain, store, generationStore, metrics, logger, now)

  for (const [order, principal] of [
    ["ORD-1", "drv_1"],
    ["ORD-2", "drv_1"],
    ["ORD-3", "buy_1"]
  ] as const) {
    store.pending.push({
      reporterId: `rep-${principal}`,
      reporterKey: principal === "drv_1" ? 11n : 12n,
      principalId: principal,
      role: principal === "drv_1" ? "courier" : "buyer",
      orderNumber: order,
      merchantPrincipalId: "mer_1",
      deliveredAt: new Date("2026-11-08T10:00:00Z")
    })
  }

  return { chain, store, metrics, logger, generationStore, rights, granter }
}

describe("adding report rights", () => {
  it("adds one right per held delivered order, in batches, under the merchant's tag and the delivery's month", async () => {
    const { chain, store, rights, metrics } = world()

    assert.equal(await rights.addDue(), 3)
    assert.equal(await rights.addDue(), 0)
    assert.equal(metrics.added, 3)

    const right = store.rights[0]

    assert.deepEqual(right?.merchantTag, chain.merchantTagOf("mer_1"))
    assert.equal(right?.window, reportWindowOf(new Date("2026-11-08T10:00:00Z")))
    assert.equal(new Set(store.rights.map((row) => Buffer.from(row.leaf).toString("hex"))).size, 3)
  })
})

describe("granting report rights", () => {
  it("grants every right in the active report generation, one transaction each, and records its index", async () => {
    const { chain, store, rights, granter, metrics } = world()

    await rights.addDue()
    await granter.settle()

    assert.equal(chain.granted.length, 3)
    assert.deepEqual(
      store.grants.map((grant) => [grant.status, grant.leafIndex]),
      [
        ["granted", 0n],
        ["granted", 1n],
        ["granted", 2n]
      ]
    )

    assert.deepEqual(metrics.grants, ["granted", "granted", "granted"])
  })

  it("grants nothing while no report generation is active", async () => {
    const { chain, rights, granter } = world([])

    await rights.addDue()
    await granter.settle()

    assert.equal(chain.granted.length, 0)
  })

  it("stops at the first failure and tries again on the next tick", async () => {
    const { chain, store, rights, granter, logger } = world()

    await rights.addDue()
    chain.grantFails = new Error("the sponsor answered 503: the sponsor wallet is still syncing")
    await granter.settle()

    assert.equal(chain.granted.length, 0)
    assert.equal(store.grants.filter((grant) => grant.status === "uncertain").length, 1)
    assert.ok(logger.lines.some((line) => line.message.startsWith("a report right could not be granted")))

    chain.grantFails = undefined
    await granter.settle()

    assert.equal(chain.granted.length, 3)
  })

  it("does not grant a right twice when a grant landed without its answer", async () => {
    const { chain, store, rights, granter } = world()

    await rights.addDue()
    chain.landsWithoutAnswer = true
    await granter.settle()
    chain.landsWithoutAnswer = false
    await granter.settle()

    assert.equal(chain.granted.length, 3)
    assert.ok(store.grants.every((grant) => grant.status === "granted"))
  })

  it("grants every right again in a new generation", async () => {
    const { chain, store, rights, granter, generationStore } = world()

    await rights.addDue()
    await granter.settle()

    const first = generationStore.rows[0]

    if (first !== undefined) {
      first.status = "retired"
    }

    generationStore.rows.push(registryGeneration({ generation: 2, contractAddress: "03bb" }))
    await granter.settle()

    assert.equal(chain.granted.length, 6)
    assert.equal(store.grants.filter((grant) => grant.generation === 2 && grant.status === "granted").length, 3)
  })
})
