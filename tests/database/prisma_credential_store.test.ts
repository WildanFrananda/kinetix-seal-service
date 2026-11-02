import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"
import { MAX_FIELD } from "@midnight-ntwrk/compact-runtime"

import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaCredentialStore from "../../src/infrastructure/postgres/prisma_credential_store.adapter.ts"
import { credentialRecord } from "../fakes/credential_record.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const store = new PrismaCredentialStore(prisma)
const queuedAt = new Date("2026-11-02T03:05:00Z")

const today = credentialRecord({ id: "00000000-0000-4000-8000-000000000002", holderPublicKey: MAX_FIELD })
const lastMonth = credentialRecord({
  id: "00000000-0000-4000-8000-000000000001",
  issueDay: 20_729,
  requestedAt: new Date("2026-10-03T03:00:00Z")
})
const otherCourier = credentialRecord({ id: "00000000-0000-4000-8000-000000000003", principalId: "drv_2" })

describe("credentials in Postgres", () => {
  beforeEach(async () => {
    await prisma.credentialIssuance.deleteMany()
    await prisma.credential.deleteMany()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("keeps a credential whole: its class, attributes, salt and a holder key as large as a field", async () => {
    assert.equal(await store.record(today), "recorded")

    assert.deepEqual(await store.byId(today.id), today)
    assert.deepEqual(await store.forDay("drv_1", today.classId, today.issueDay), today)
    assert.equal(await store.forDay("drv_1", today.classId, today.issueDay + 1), undefined)
  })

  it("keeps one credential per courier, class and day", async () => {
    await store.record(today)

    assert.equal(await store.record({ ...today, id: "00000000-0000-4000-8000-0000000000ff" }), "conflict")
    assert.equal(await prisma.credential.count(), 1)
  })

  it("knows which of a courier's credentials is the current one", async () => {
    await store.record(lastMonth)
    await store.record(today)

    assert.equal(await store.isCurrent(today), true)
    assert.equal(await store.isCurrent(lastMonth), false)
  })

  it("queues each courier's current credential once per generation", async () => {
    await store.record(lastMonth)
    await store.record(today)
    await store.record(otherCourier)

    assert.equal(await store.queueCurrent(1, queuedAt), 2)
    assert.equal(await store.queueCurrent(1, queuedAt), 0)
    assert.equal(await store.issuanceOf(lastMonth.id, 1), undefined)
    assert.deepEqual(await store.issuanceOf(today.id, 1), {
      credentialId: today.id,
      generation: 1,
      status: "pending",
      leaf: undefined,
      leafIndex: undefined,
      txId: undefined
    })
    assert.equal(await store.queueCurrent(2, queuedAt), 2)
  })

  it("hands out the oldest unsettled issuance with its credential, and none once issued", async () => {
    await store.record(today)
    await store.queueCurrent(1, queuedAt)

    const next = await store.nextUnsettled(1)

    assert.deepEqual(next?.credential, today)
    assert.equal(next?.issuance.status, "pending")

    const leaf = new Uint8Array(32).fill(0xab)

    await store.markUncertain(today.id, 1, leaf, queuedAt)

    const uncertain = await store.nextUnsettled(1)

    assert.equal(uncertain?.issuance.status, "uncertain")
    assert.deepEqual(uncertain?.issuance.leaf, leaf)

    await store.markIssued(today.id, 1, 9_007_199_254_740_993n, "00ab", queuedAt)

    assert.equal(await store.nextUnsettled(1), undefined)
    assert.deepEqual(await store.issuanceOf(today.id, 1), {
      credentialId: today.id,
      generation: 1,
      status: "issued",
      leaf,
      leafIndex: 9_007_199_254_740_993n,
      txId: "00ab"
    })

    const row = await prisma.credentialIssuance.findUnique({
      where: { credentialId_generation: { credentialId: today.id, generation: 1 } }
    })

    assert.equal(row?.attempts, 1)
  })

  it("records an issuance found in the registry without its transaction", async () => {
    await store.record(today)
    await store.queueCurrent(1, queuedAt)
    await store.markIssued(today.id, 1, 3n, undefined, queuedAt)

    assert.equal((await store.issuanceOf(today.id, 1))?.txId, undefined)
  })
})
