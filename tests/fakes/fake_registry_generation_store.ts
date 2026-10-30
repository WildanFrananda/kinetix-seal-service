import type { RegistryGenerationStorePort } from "../../src/application/ports/registry_generation_store.port.ts"
import type { DeployReceipt } from "../../src/types/deploy_receipt.type.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import type { RegistryRetirement } from "../../src/types/registry_retirement.type.ts"

class FakeRegistryGenerationStore implements RegistryGenerationStorePort {
  readonly rows: RegistryGeneration[]
  readonly retirements: RegistryRetirement[] = []

  constructor(rows: RegistryGeneration[]) {
    this.rows = rows
  }

  async unretired(): Promise<RegistryGeneration[]> {
    return this.rows.filter((row) => row.status !== "retired").map((row) => ({ ...row }))
  }

  async highestGeneration(): Promise<number> {
    return Math.max(0, ...this.rows.map((row) => row.generation))
  }

  async recordDeploying(generation: RegistryGeneration): Promise<void> {
    this.rows.push({ ...generation })
  }

  async activate(generation: number, receipt: DeployReceipt): Promise<void> {
    const row = this.rows.find((candidate) => candidate.generation === generation && candidate.status === "deploying")

    if (row === undefined) {
      throw new Error(`generation ${generation} is not deploying`)
    }

    row.status = "active"
    row.deployTxId = receipt.txId
    row.anchorHeight = receipt.blockHeight
    row.anchorHash = receipt.blockHash
  }

  async retire(retirement: RegistryRetirement): Promise<void> {
    const row = this.rows.find((candidate) => candidate.generation === retirement.generation)

    if (row !== undefined) {
      row.status = "retired"
    }

    this.retirements.push(retirement)
  }

  statusOf(generation: number): string | undefined {
    return this.rows.find((row) => row.generation === generation)?.status
  }
}

export default FakeRegistryGenerationStore
