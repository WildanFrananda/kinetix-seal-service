import assert from "node:assert/strict"
import { describe, it } from "node:test"

import ReportKeeper from "../../src/application/report_keeper.service.ts"
import FakeFiledReportStore from "../fakes/fake_filed_report_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeReportChain from "../fakes/fake_report_chain.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingReportMetrics from "../fakes/recording_report_metrics.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const nullifierA = "11".repeat(32)
const nullifierB = "22".repeat(32)
const merchantTag = "33".repeat(32)
const salt = "44".repeat(32)
const digestA = "55".repeat(32)
const digestB = "66".repeat(32)

function bytesOf(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"))
}

describe("report keeper", () => {
  it("confirms submitted reports once present on chain with matching digest", async () => {
    const generations = new FakeRegistryGenerationStore([
      registryGeneration({ generation: 1, contractAddress: "02gen1" })
    ])

    const reports = new FakeFiledReportStore()
    const chain = new FakeReportChain()
    const metrics = new RecordingReportMetrics()
    const logger = new RecordingLogger()
    const keeper = new ReportKeeper({ generations, reports, chain, metrics, logger })

    await reports.insertSubmitted({
      nullifier: nullifierA,
      categorySlug: "fraud",
      body: "fake item",
      salt,
      digest: digestA,
      merchantTag,
      window: 682n,
      status: "submitted",
      firstGeneration: 1,
      txId: "00sp1",
      submittedAt: new Date("2026-11-14T09:00:00Z"),
      confirmedAt: undefined
    })

    await reports.insertSubmitted({
      nullifier: nullifierB,
      categorySlug: "abuse",
      body: "not landed yet",
      salt,
      digest: digestB,
      merchantTag,
      window: 682n,
      status: "submitted",
      firstGeneration: 1,
      txId: "00sp2",
      submittedAt: new Date("2026-11-14T09:05:00Z"),
      confirmedAt: undefined
    })

    chain.recordOnChainReport("02gen1", {
      nullifier: bytesOf(nullifierA),
      merchantTag: bytesOf(merchantTag),
      window: 682n,
      digest: bytesOf(digestA)
    })

    await keeper.keep(new Date("2026-11-14T09:10:00Z"))

    assert.equal((await reports.findByNullifier(nullifierA))?.status, "confirmed")
    assert.equal((await reports.findByNullifier(nullifierB))?.status, "submitted")
    assert.equal(metrics.confirmed, 1)
  })

  it("carries confirmed reports into a newer generation via seedReport and recovers uncertain timeouts", async () => {
    const generations = new FakeRegistryGenerationStore([
      registryGeneration({ generation: 1, contractAddress: "02gen1", status: "retired" }),
      registryGeneration({ generation: 2, contractAddress: "02gen2", status: "active" })
    ])

    const reports = new FakeFiledReportStore()
    const chain = new FakeReportChain()
    const metrics = new RecordingReportMetrics()
    const logger = new RecordingLogger()
    const keeper = new ReportKeeper({ generations, reports, chain, metrics, logger })

    await reports.insertSubmitted({
      nullifier: nullifierA,
      categorySlug: "counterfeit",
      body: "carried report",
      salt,
      digest: digestA,
      merchantTag,
      window: 682n,
      status: "submitted",
      firstGeneration: 1,
      txId: "00sp1",
      submittedAt: new Date("2026-11-14T09:00:00Z"),
      confirmedAt: undefined
    })

    await reports.markConfirmed(nullifierA, new Date("2026-11-14T09:02:00Z"))

    chain.landsSeedWithoutAnswer = true
    await keeper.keep(new Date("2026-11-14T10:00:00Z"))

    assert.deepEqual(metrics.seeds, ["failed"])
    assert.equal(reports.seeds.get(`${nullifierA}:2`)?.status, "uncertain")

    chain.landsSeedWithoutAnswer = false
    await keeper.keep(new Date("2026-11-14T10:01:00Z"))

    assert.deepEqual(metrics.seeds, ["failed", "seeded"])
    assert.equal(reports.seeds.get(`${nullifierA}:2`)?.status, "seeded")
    assert.equal(chain.seeded.length, 1)
  })
})
