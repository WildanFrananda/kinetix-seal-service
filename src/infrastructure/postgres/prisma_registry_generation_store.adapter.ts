import type { RegistryGenerationStorePort } from "../../application/ports/registry_generation_store.port.ts"
import type { DeployReceipt } from "../../types/deploy_receipt.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import type { RegistryGenerationStatus } from "../../types/registry_generation_status.type.ts"
import type { RegistryRetirement } from "../../types/registry_retirement.type.ts"
import type { PrismaClient } from "./generated/client.ts"

const statuses: readonly RegistryGenerationStatus[] = ["deploying", "active", "retired"]

class PrismaRegistryGenerationStore implements RegistryGenerationStorePort {
  readonly #prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma
  }

  async unretired(): Promise<RegistryGeneration[]> {
    const rows = await this.#prisma.registryGeneration.findMany({
      where: { status: { not: "retired" } },
      orderBy: { generation: "asc" }
    })

    return rows.map((row) => {
      const status = statuses.find((candidate) => candidate === row.status)

      if (status === undefined) {
        throw new Error(`registry_generations row ${row.generation} holds an unknown status: ${row.status}`)
      }

      return {
        generation: row.generation,
        contractAddress: row.contractAddress,
        networkId: row.networkId,
        buildDigest: row.buildDigest,
        status,
        deployTxId: row.deployTxId ?? undefined,
        anchorHeight: row.anchorHeight === null ? undefined : Number(row.anchorHeight),
        anchorHash: row.anchorHash ?? undefined
      }
    })
  }

  async highestGeneration(): Promise<number> {
    const highest = await this.#prisma.registryGeneration.aggregate({ _max: { generation: true } })

    return highest._max.generation ?? 0
  }

  async recordDeploying(generation: RegistryGeneration): Promise<void> {
    await this.#prisma.registryGeneration.create({
      data: {
        generation: generation.generation,
        contractAddress: generation.contractAddress,
        networkId: generation.networkId,
        buildDigest: generation.buildDigest,
        status: "deploying"
      }
    })
  }

  async activate(generation: number, receipt: DeployReceipt): Promise<void> {
    const updated = await this.#prisma.registryGeneration.updateMany({
      where: { generation, status: "deploying" },
      data: {
        status: "active",
        deployTxId: receipt.txId,
        anchorHeight: BigInt(receipt.blockHeight),
        anchorHash: receipt.blockHash,
        activatedAt: new Date()
      }
    })

    if (updated.count !== 1) {
      throw new Error(`registry generation ${generation} was not deploying, so it cannot become active`)
    }
  }

  async retire(retirement: RegistryRetirement): Promise<void> {
    await this.#prisma.registryGeneration.updateMany({
      where: { generation: retirement.generation, status: { not: "retired" } },
      data: { status: "retired", retiredReason: retirement.reason, retiredAt: new Date() }
    })
  }
}

export default PrismaRegistryGenerationStore
