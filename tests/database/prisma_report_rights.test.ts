import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaDeliveredOrderStore from "../../src/infrastructure/postgres/prisma_delivered_order_store.adapter.ts"
import PrismaReportRightStore from "../../src/infrastructure/postgres/prisma_report_right_store.adapter.ts"
import PrismaReporterStore from "../../src/infrastructure/postgres/prisma_reporter_store.adapter.ts"
import type { ReportRight } from "../../src/types/report_right.type.ts"
import type { RightCandidate } from "../../src/types/right_candidate.type.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const orders = new PrismaDeliveredOrderStore(prisma)
const reporters = new PrismaReporterStore(prisma)
const rights = new PrismaReportRightStore(prisma)
const zero = { transactionId: 0n, sequence: 0n }
const tag = new Uint8Array(32).fill(5)
let ids = 0

function uuid(): string {
  ids += 1

  return `00000000-0000-4000-8000-${ids.toString().padStart(12, "0")}`
}

function rightFor(candidate: RightCandidate): ReportRight {
  return {
    id: uuid(),
    reporterId: candidate.reporterId,
    principalId: candidate.principalId,
    role: candidate.role,
    orderNumber: candidate.orderNumber,
    merchantTag: tag,
    window: 682,
    leaf: new Uint8Array(32).fill(ids % 250),
    createdAt: new Date("2026-11-12T05:00:00Z")
  }
}

async function deliver(orderNumber: string, buyer: string, driver: string, deliveredAt: string): Promise<void> {
  const from = await orders.cursor()
  const next = { transactionId: from.transactionId + 1n, sequence: 1n }

  await orders.recordDelivered(
    from,
    next,
    [{ orderNumber, buyerPrincipalId: buyer, merchantPrincipalId: "mer_1", deliveredAt: new Date(deliveredAt) }],
    true
  )

  await prisma.courierDelivery.create({
    data: { orderNumber, driverPrincipalId: driver, deliveredAt: new Date(deliveredAt) }
  })
}

async function register(principalId: string, role: "buyer" | "courier", key: bigint, at: string): Promise<string> {
  const id = uuid()

  await reporters.record({ id, principalId, role, reporterKey: key, registeredAt: new Date(at) })

  return id
}

describe("report rights in Postgres", () => {
  beforeEach(async () => {
    await prisma.reportRightGrant.deleteMany()
    await prisma.reportRight.deleteMany()
    await prisma.reporter.deleteMany()
    await prisma.deliveredOrder.deleteMany()
    await prisma.courierDelivery.deleteMany()
    await prisma.feedCursor.update({
      where: { stream: "orders" },
      data: { throughTransaction: 0n, throughSequence: 0n, caughtUpAt: null }
    })
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("keeps a delivered order once and moves the cursor only from where it was", async () => {
    await deliver("ORD-1", "buy_1", "drv_1", "2026-11-08T10:00:00Z")

    assert.equal(await prisma.deliveredOrder.count(), 1)
    await assert.rejects(orders.recordDelivered(zero, { transactionId: 9n, sequence: 1n }, [], false), /moved/)
  })

  it("refuses a reporter key a second time", async () => {
    await register("drv_1", "courier", 11n, "2026-11-12T05:00:00Z")

    assert.equal(
      await reporters.record({
        id: uuid(),
        principalId: "drv_2",
        role: "courier",
        reporterKey: 11n,
        registeredAt: new Date()
      }),
      "conflict"
    )

    assert.equal((await reporters.byKey(11n))?.principalId, "drv_1")
  })

  it("offers a buyer their orders and a courier the orders they carried, and nobody else's", async () => {
    await deliver("ORD-1", "buy_1", "drv_1", "2026-11-08T10:00:00Z")
    await deliver("ORD-2", "buy_2", "drv_2", "2026-11-09T10:00:00Z")
    await register("buy_1", "buyer", 21n, "2026-11-12T05:00:00Z")
    await register("drv_1", "courier", 11n, "2026-11-12T05:00:00Z")

    const offered = await rights.candidates(50)

    assert.deepEqual(
      offered.map((candidate) => [candidate.principalId, candidate.role, candidate.orderNumber]).sort(),
      [
        ["buy_1", "buyer", "ORD-1"],
        ["drv_1", "courier", "ORD-1"]
      ]
    )

    assert.equal(offered.find((candidate) => candidate.role === "courier")?.merchantPrincipalId, "mer_1")
  })

  it("gives a new key on a new device only the orders no earlier key holds a right for", async () => {
    await deliver("ORD-1", "buy_1", "drv_1", "2026-11-08T10:00:00Z")

    const first = await register("buy_1", "buyer", 21n, "2026-11-10T05:00:00Z")

    assert.equal(await rights.insert((await rights.candidates(50)).map(rightFor)), 1)

    const second = await register("buy_1", "buyer", 22n, "2026-11-12T05:00:00Z")

    assert.deepEqual(await rights.candidates(50), [])

    await deliver("ORD-2", "buy_1", "drv_1", "2026-11-12T10:00:00Z")

    const offered = await rights.candidates(50)

    assert.deepEqual(
      offered.map((candidate) => [candidate.orderNumber, candidate.reporterId]),
      [["ORD-2", second]]
    )

    assert.notEqual(first, second)
  })

  it("queues every right once per generation, settles them in order, and counts each crowd by holders", async () => {
    await deliver("ORD-1", "buy_1", "drv_1", "2026-11-08T10:00:00Z")
    await deliver("ORD-2", "buy_1", "drv_1", "2026-11-09T10:00:00Z")
    await register("buy_1", "buyer", 21n, "2026-11-12T05:00:00Z")
    await register("drv_1", "courier", 11n, "2026-11-12T05:00:00Z")
    await rights.insert((await rights.candidates(50)).map(rightFor))

    const at = new Date("2026-11-12T06:00:00Z")

    assert.equal(await rights.queueAll(1, at), 4)
    assert.equal(await rights.queueAll(1, at), 0)

    for (let index = 0n; ; index += 1n) {
      const next = await rights.nextUnsettled(1)

      if (next === undefined) {
        break
      }

      await rights.markUncertain(next.right.id, 1, at)
      assert.equal((await rights.nextUnsettled(1))?.status, "uncertain")
      await rights.markGranted(next.right.id, 1, index, `00gr${index}`, at)
    }

    const held = await rights.heldBy("buy_1", 1)

    assert.deepEqual(
      held.map((right) => [right.orderNumber, right.reporterKey, right.window, right.crowd]),
      [
        ["ORD-1", 21n, 682, 2],
        ["ORD-2", 21n, 682, 2]
      ]
    )

    assert.ok(held.every((right) => right.leafIndex !== undefined))
    assert.deepEqual(
      (await rights.heldBy("buy_1", 2)).map((right) => [right.leafIndex, right.crowd]),
      [
        [undefined, 0],
        [undefined, 0]
      ]
    )

    assert.equal(await rights.queueAll(2, at), 4)
  })
})
