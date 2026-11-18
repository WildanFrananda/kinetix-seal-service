import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { hexOf } from "../../src/domain/hex.ts"
import { merchantTagOf } from "../../src/domain/merchant_tag.ts"
import PrismaCaseStore from "../../src/infrastructure/postgres/prisma_case_store.adapter.ts"
import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaFiledReportStore from "../../src/infrastructure/postgres/prisma_filed_report_store.adapter.ts"
import PrismaReportRightStore from "../../src/infrastructure/postgres/prisma_report_right_store.adapter.ts"
import PrismaReporterStore from "../../src/infrastructure/postgres/prisma_reporter_store.adapter.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const issuerSecret = new Uint8Array(32).fill(0x5d)
const caseStore = new PrismaCaseStore(prisma, issuerSecret)
const reporters = new PrismaReporterStore(prisma)
const rights = new PrismaReportRightStore(prisma)
const filedReports = new PrismaFiledReportStore(prisma)

const merchantA = "11111111-1111-4111-8111-111111111111"
const merchantB = "22222222-2222-4222-8222-222222222222"

describe("merchant cases in Postgres", () => {
  beforeEach(async () => {
    await prisma.reportSeed.deleteMany()
    await prisma.filedReport.deleteMany()
    await prisma.reportRightGrant.deleteMany()
    await prisma.reportRight.deleteMany()
    await prisma.reporter.deleteMany()
    await prisma.deliveredOrder.deleteMany()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("groups filed reports per merchant tag, resolves principals, and filters by status", async () => {
    const tagA = hexOf(merchantTagOf(issuerSecret, merchantA))
    const tagB = hexOf(merchantTagOf(issuerSecret, merchantB))

    await prisma.deliveredOrder.createMany({
      data: [
        {
          orderNumber: "ORD-1",
          buyerPrincipalId: "buy_1",
          merchantPrincipalId: merchantA,
          deliveredAt: new Date("2026-10-15T10:00:00Z")
        },
        {
          orderNumber: "ORD-2",
          buyerPrincipalId: "buy_2",
          merchantPrincipalId: merchantB,
          deliveredAt: new Date("2026-11-02T10:00:00Z")
        }
      ]
    })

    await reporters.record({
      id: "00000000-0000-4000-8000-000000000001",
      principalId: "buy_1",
      role: "buyer",
      reporterKey: 101n,
      registeredAt: new Date("2026-10-16T08:00:00Z")
    })

    await rights.insert([
      {
        id: "00000000-0000-4000-8000-000000000011",
        reporterId: "00000000-0000-4000-8000-000000000001",
        principalId: "buy_1",
        role: "buyer",
        orderNumber: "ORD-1",
        merchantTag: merchantTagOf(issuerSecret, merchantA),
        window: 202610,
        leaf: new Uint8Array(32).fill(0x11),
        createdAt: new Date("2026-10-16T08:05:00Z")
      }
    ])

    await filedReports.insertSubmitted({
      nullifier: "a1".repeat(32),
      categorySlug: "fraud",
      body: "merchant kept deposit after cancellation",
      salt: "10".repeat(32),
      digest: "20".repeat(32),
      merchantTag: tagA,
      window: 202610n,
      status: "submitted",
      firstGeneration: 1,
      txId: "tx-a1",
      submittedAt: new Date("2026-10-20T08:00:00Z"),
      confirmedAt: undefined
    })

    await filedReports.markConfirmed("a1".repeat(32), new Date("2026-10-20T08:04:00Z"))

    await filedReports.insertSubmitted({
      nullifier: "a2".repeat(32),
      categorySlug: "abuse",
      body: "rude threat on receipt",
      salt: "11".repeat(32),
      digest: "21".repeat(32),
      merchantTag: tagA,
      window: 202611n,
      status: "submitted",
      firstGeneration: 1,
      txId: "tx-a2",
      submittedAt: new Date("2026-11-01T09:00:00Z"),
      confirmedAt: undefined
    })

    await filedReports.insertSubmitted({
      nullifier: "b1".repeat(32),
      categorySlug: "counterfeit",
      body: "counterfeit seal printed on label",
      salt: "12".repeat(32),
      digest: "22".repeat(32),
      merchantTag: tagB,
      window: 202611n,
      status: "submitted",
      firstGeneration: 1,
      txId: "tx-b1",
      submittedAt: new Date("2026-11-05T10:00:00Z"),
      confirmedAt: undefined
    })

    const allCases = await caseStore.listCases("all")
    const confirmedOnly = await caseStore.listCases("confirmed")
    const principals = await caseStore.resolveMerchants([tagA, tagB])
    const detailConfirmed = await caseStore.findCase(tagA, "confirmed")
    const missing = await caseStore.findCase("ff".repeat(32), "all")

    assert.equal(allCases.length, 2)
    assert.equal(allCases[0]?.merchantTag, tagB)
    assert.equal(confirmedOnly.length, 1)
    assert.equal(confirmedOnly[0]?.merchantTag, tagA)
    assert.equal(confirmedOnly[0]?.confirmedCount, 1)
    assert.equal(confirmedOnly[0]?.pendingCount, 1)
    assert.equal(confirmedOnly[0]?.windowCount, 2)
    assert.equal(principals.get(tagA), merchantA)
    assert.equal(principals.get(tagB), merchantB)
    assert.equal(missing, undefined)
    assert.equal(detailConfirmed?.reports.length, 1)
    assert.equal(detailConfirmed?.reports[0]?.category.label, "Fraud or misrepresentation")
  })
})
