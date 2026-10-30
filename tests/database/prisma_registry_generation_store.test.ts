import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaRegistryGenerationStore from "../../src/infrastructure/postgres/prisma_registry_generation_store.adapter.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const store = new PrismaRegistryGenerationStore(prisma)

const deploying = registryGeneration({
  generation: 1,
  contractAddress: "02ab",
  status: "deploying",
  deployTxId: undefined,
  anchorHeight: undefined,
  anchorHash: undefined
})

describe("registry generations in Postgres", () => {
  beforeEach(async () => {
    await prisma.registryGeneration.deleteMany()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("starts with no generation", async () => {
    assert.deepEqual(await store.unretired(), [])
    assert.equal(await store.highestGeneration(), 0)
  })

  it("records a deploy, then where it landed", async () => {
    await store.recordDeploying(deploying)

    assert.deepEqual(await store.unretired(), [deploying])

    await store.activate(1, { txId: "00ee", blockHeight: 3_201_705, blockHash: "c".repeat(64) })

    const [active] = await store.unretired()

    assert.equal(active?.status, "active")
    assert.equal(active?.anchorHeight, 3_201_705)
    assert.equal(active?.anchorHash, "c".repeat(64))
    assert.equal(active?.deployTxId, "00ee")
  })

  it("refuses to activate a generation that is not deploying", async () => {
    await store.recordDeploying(deploying)
    await store.activate(1, { txId: "00ee", blockHeight: 1, blockHash: "c".repeat(64) })

    await assert.rejects(
      store.activate(1, { txId: "00ff", blockHeight: 2, blockHash: "d".repeat(64) }),
      /was not deploying/
    )
  })

  it("keeps a retired generation out of the live ones, and counts it in the numbering", async () => {
    await store.recordDeploying(deploying)
    await store.retire({ generation: 1, reason: "interrupted" })

    assert.deepEqual(await store.unretired(), [])
    assert.equal(await store.highestGeneration(), 1)

    const row = await prisma.registryGeneration.findUnique({ where: { generation: 1 } })

    assert.equal(row?.retiredReason, "interrupted")
  })

  it("refuses a second generation at the same contract address", async () => {
    await store.recordDeploying(deploying)

    await assert.rejects(store.recordDeploying({ ...deploying, generation: 2 }))
  })
})
