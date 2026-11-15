import assert from "node:assert/strict"
import { describe, it } from "node:test"

import ReportSubmissions from "../../src/application/report_submissions.service.ts"
import { reportDigestOf } from "../../src/domain/report_digest.ts"
import FakeFiledReportStore from "../fakes/fake_filed_report_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import FakeReportCategoryStore from "../fakes/fake_report_category_store.ts"
import FakeReportChain from "../fakes/fake_report_chain.ts"
import FakeReportInspector from "../fakes/fake_report_inspector.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingReportMetrics from "../fakes/recording_report_metrics.ts"
import RecordingTransactionPayer from "../fakes/recording_transaction_payer.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const contractAddress = "0201aa"
const saltBytes = new Uint8Array(32).fill(0x41)
const saltHex = Buffer.from(saltBytes).toString("hex")
const nullifierBytes = new Uint8Array(32).fill(0x11)
const nullifierHex = Buffer.from(nullifierBytes).toString("hex")
const merchantTagBytes = new Uint8Array(32).fill(0x22)
const merchantTagHex = Buffer.from(merchantTagBytes).toString("hex")
const window = 682n
const now = new Date("2026-11-14T10:00:00Z")

function setup(minimumHolders = 20) {
  const categories = new FakeReportCategoryStore()
  const generations = new FakeRegistryGenerationStore([registryGeneration({ generation: 1, contractAddress })])
  const reports = new FakeFiledReportStore()
  const inspector = new FakeReportInspector()
  const chain = new FakeReportChain()
  const payer = new RecordingTransactionPayer()
  const metrics = new RecordingReportMetrics()
  const logger = new RecordingLogger()

  reports.setHolders(1, merchantTagHex, window, minimumHolders)

  inspector.result = {
    calls: [
      {
        address: contractAddress,
        entryPoint: "report",
        nullifier: nullifierBytes,
        merchantTag: merchantTagBytes,
        window,
        digest: reportDigestOf("counterfeit", "sealed packaging opened", saltBytes)
      }
    ],
    otherActions: 0,
    offers: 0
  }

  const submissions = new ReportSubmissions({
    categories,
    generations,
    reports,
    inspector,
    chain,
    payer,
    metrics,
    logger,
    minimumHolders
  })

  return { submissions, categories, generations, reports, inspector, chain, payer, metrics, logger }
}

describe("report submissions", () => {
  it("sponsors a valid report when category, digest, nullifier, and crowd threshold pass", async () => {
    const { submissions, payer, metrics, reports } = setup()

    const outcome = await submissions.submit(
      {
        transaction: Uint8Array.from([1, 2, 3]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      },
      now
    )

    assert.deepEqual(outcome, {
      kind: "accepted",
      nullifier: nullifierHex,
      txId: "00sp1",
      status: "submitted"
    })

    assert.equal(payer.sponsored.length, 1)
    assert.deepEqual(metrics.submissions, ["accepted"])
    assert.equal((await reports.findByNullifier(nullifierHex))?.status, "submitted")
    assert.deepEqual(await submissions.statusOf(nullifierHex), {
      nullifier: nullifierHex,
      status: "submitted",
      generation: 1,
      txId: "00sp1",
      submittedAt: now,
      confirmedAt: undefined
    })
  })

  it("refuses unknown categories, invalid bodies, and bad salts without touching chain or sponsor", async () => {
    const { submissions, payer, metrics } = setup()

    assert.deepEqual(
      await submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "other",
        body: "evidence",
        salt: saltHex
      }),
      { kind: "unknown_category" }
    )

    assert.deepEqual(
      await submissions.submit({ transaction: Uint8Array.from([1]), category: "fraud", body: "   ", salt: saltHex }),
      { kind: "invalid_body" }
    )

    assert.deepEqual(
      await submissions.submit({ transaction: Uint8Array.from([1]), category: "fraud", body: "evidence", salt: "zz" }),
      { kind: "invalid_salt" }
    )

    assert.equal(payer.sponsored.length, 0)
    assert.deepEqual(metrics.submissions, ["unknown_category", "invalid_body", "invalid_salt"])
  })

  it("refuses transactions with no active registry, non-report shape, or digest mismatch", async () => {
    const empty = setup()

    empty.generations.rows.length = 0
    assert.deepEqual(
      await empty.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      }),
      { kind: "registry_unavailable" }
    )

    const wrongShape = setup()

    wrongShape.inspector.result = {
      calls: [
        {
          address: contractAddress,
          entryPoint: "grant",
          nullifier: nullifierBytes,
          merchantTag: merchantTagBytes,
          window,
          digest: reportDigestOf("counterfeit", "sealed packaging opened", saltBytes)
        }
      ],
      otherActions: 0,
      offers: 0
    }

    assert.deepEqual(
      await wrongShape.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      }),
      { kind: "not_a_report" }
    )

    const mismatch = setup()

    assert.deepEqual(
      await mismatch.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "different text",
        salt: saltHex
      }),
      { kind: "digest_mismatch" }
    )

    assert.equal(mismatch.payer.sponsored.length, 0)
  })

  it("enforces anonymity crowd size and nullifier uniqueness in Postgres and on chain before sponsoring", async () => {
    const smallCrowd = setup(20)

    smallCrowd.reports.setHolders(1, merchantTagHex, window, 19)
    assert.deepEqual(
      await smallCrowd.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      }),
      { kind: "crowd_too_small", holders: 19, minimum: 20 }
    )

    assert.equal(smallCrowd.payer.sponsored.length, 0)

    const onChainDuplicate = setup()

    onChainDuplicate.chain.recordOnChainReport(contractAddress, {
      nullifier: nullifierBytes,
      merchantTag: merchantTagBytes,
      window,
      digest: reportDigestOf("counterfeit", "sealed packaging opened", saltBytes)
    })

    assert.deepEqual(
      await onChainDuplicate.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      }),
      { kind: "already_reported" }
    )

    assert.equal(onChainDuplicate.payer.sponsored.length, 0)

    const secondSubmit = setup()

    await secondSubmit.submissions.submit({
      transaction: Uint8Array.from([1]),
      category: "counterfeit",
      body: "sealed packaging opened",
      salt: saltHex
    })

    assert.deepEqual(
      await secondSubmit.submissions.submit({
        transaction: Uint8Array.from([1]),
        category: "counterfeit",
        body: "sealed packaging opened",
        salt: saltHex
      }),
      { kind: "already_reported" }
    )

    assert.equal(secondSubmit.payer.sponsored.length, 1)
  })

  it("maps sponsor failure without storing the report or logging sensitive submission text", async () => {
    const { submissions, payer, reports, logger } = setup()

    payer.failure = new Error("sponsor out of dust")
    const outcome = await submissions.submit({
      transaction: Uint8Array.from([1]),
      category: "counterfeit",
      body: "sealed packaging opened",
      salt: saltHex
    })

    assert.deepEqual(outcome, { kind: "sponsor_unavailable" })
    assert.equal(await reports.findByNullifier(nullifierHex), undefined)
    assert.equal(JSON.stringify(logger.lines).includes("sealed packaging opened"), false)
    assert.equal(JSON.stringify(logger.lines).includes(saltHex), false)
  })
})
