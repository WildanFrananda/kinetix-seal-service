import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { hexOf } from "../../src/domain/hex.ts"
import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaFiledReportStore from "../../src/infrastructure/postgres/prisma_filed_report_store.adapter.ts"
import PrismaReportCategoryStore from "../../src/infrastructure/postgres/prisma_report_category_store.adapter.ts"
import PrismaReportRightStore from "../../src/infrastructure/postgres/prisma_report_right_store.adapter.ts"
import PrismaReporterStore from "../../src/infrastructure/postgres/prisma_reporter_store.adapter.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const categoryStore = new PrismaReportCategoryStore(prisma)
const filedReportStore = new PrismaFiledReportStore(prisma)
const reporters = new PrismaReporterStore(prisma)
const rightStore = new PrismaReportRightStore(prisma)

const merchantTagBytes = new Uint8Array(32).fill(0x3a)
const merchantTagHex = hexOf(merchantTagBytes)

describe("filed reports and categories in Postgres", () => {
  beforeEach(async () => {
    await prisma.reportSeed.deleteMany()
    await prisma.filedReport.deleteMany()
    await prisma.reportRightGrant.deleteMany()
    await prisma.reportRight.deleteMany()
    await prisma.reporter.deleteMany()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("reads active report categories seeded by migration", async () => {
    const categories = await categoryStore.listActive()

    assert.deepEqual(
      categories.map((category) => category.slug),
      ["abuse", "counterfeit", "fraud"]
    )

    assert.equal((await categoryStore.findActive("fraud"))?.active, true)
    assert.equal(await categoryStore.findActive("nonexistent"), undefined)
  })

  it("counts distinct granted principals in a merchant window", async () => {
    const at = new Date("2026-11-14T08:00:00Z")

    await reporters.record({
      id: "00000000-0000-4000-8000-000000000001",
      principalId: "buy_1",
      role: "buyer",
      reporterKey: 101n,
      registeredAt: at
    })

    await reporters.record({
      id: "00000000-0000-4000-8000-000000000002",
      principalId: "buy_1",
      role: "courier",
      reporterKey: 102n,
      registeredAt: at
    })

    await reporters.record({
      id: "00000000-0000-4000-8000-000000000003",
      principalId: "buy_2",
      role: "buyer",
      reporterKey: 103n,
      registeredAt: at
    })

    await rightStore.insert([
      {
        id: "00000000-0000-4000-8000-000000000011",
        reporterId: "00000000-0000-4000-8000-000000000001",
        principalId: "buy_1",
        role: "buyer",
        orderNumber: "ORD-1",
        merchantTag: merchantTagBytes,
        window: 682,
        leaf: new Uint8Array(32).fill(1),
        createdAt: at
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        reporterId: "00000000-0000-4000-8000-000000000002",
        principalId: "buy_1",
        role: "courier",
        orderNumber: "ORD-2",
        merchantTag: merchantTagBytes,
        window: 682,
        leaf: new Uint8Array(32).fill(2),
        createdAt: at
      },
      {
        id: "00000000-0000-4000-8000-000000000013",
        reporterId: "00000000-0000-4000-8000-000000000003",
        principalId: "buy_2",
        role: "buyer",
        orderNumber: "ORD-3",
        merchantTag: merchantTagBytes,
        window: 682,
        leaf: new Uint8Array(32).fill(3),
        createdAt: at
      }
    ])

    await rightStore.queueAll(1, at)
    await rightStore.markGranted("00000000-0000-4000-8000-000000000011", 1, 0n, "00tx1", at)
    await rightStore.markGranted("00000000-0000-4000-8000-000000000012", 1, 1n, "00tx2", at)
    await rightStore.markGranted("00000000-0000-4000-8000-000000000013", 1, 2n, "00tx3", at)

    assert.equal(await filedReportStore.grantedHoldersCount(1, merchantTagHex, 682n), 2)
    assert.equal(await filedReportStore.grantedHoldersCount(1, merchantTagHex, 683n), 0)
  })

  it("persists submitted reports idempotently, confirms them, and queues carry-over seeds", async () => {
    const t0 = new Date("2026-11-14T10:00:00Z")
    const nullifier = "aa".repeat(32)
    const digest = "cc".repeat(32)

    const inserted = await filedReportStore.insertSubmitted({
      nullifier,
      categorySlug: "counterfeit",
      body: "counterfeit serial number",
      salt: "bb".repeat(32),
      digest,
      merchantTag: merchantTagHex,
      window: 682n,
      status: "submitted",
      firstGeneration: 1,
      txId: "00sp1",
      submittedAt: t0,
      confirmedAt: undefined
    })

    const duplicate = await filedReportStore.insertSubmitted({
      nullifier,
      categorySlug: "counterfeit",
      body: "duplicate",
      salt: "bb".repeat(32),
      digest,
      merchantTag: merchantTagHex,
      window: 682n,
      status: "submitted",
      firstGeneration: 1,
      txId: "00sp2",
      submittedAt: t0,
      confirmedAt: undefined
    })

    assert.equal(inserted, true)
    assert.equal(duplicate, false)
    assert.equal((await filedReportStore.unconfirmedSubmitted(10)).length, 1)
    assert.equal(await filedReportStore.queueMissingSeeds(2, t0), 0)

    await filedReportStore.markConfirmed(nullifier, new Date("2026-11-14T10:02:00Z"))
    assert.equal((await filedReportStore.findByNullifier(nullifier))?.status, "confirmed")
    assert.equal(await filedReportStore.queueMissingSeeds(1, t0), 0)
    assert.equal(await filedReportStore.queueMissingSeeds(2, t0), 1)
    assert.equal(await filedReportStore.queueMissingSeeds(2, t0), 0)

    const next = await filedReportStore.nextUnsettledSeed(2)

    assert.equal(next?.nullifier, nullifier)
    assert.equal(next?.status, "pending")

    await filedReportStore.markSeedUncertain(nullifier, 2, new Date("2026-11-14T10:03:00Z"))
    const uncertain = await filedReportStore.nextUnsettledSeed(2)

    assert.equal(uncertain?.status, "uncertain")
    assert.equal(uncertain?.attempts, 1)

    await filedReportStore.markSeeded(nullifier, 2, "00sd1", new Date("2026-11-14T10:04:00Z"))
    assert.equal(await filedReportStore.nextUnsettledSeed(2), undefined)
  })
})
