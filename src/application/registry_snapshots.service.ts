import type { RegistrySnapshot } from "../types/registry_snapshot.type.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import type { RegistrySnapshotSourcePort } from "./ports/registry_snapshot_source.port.ts"

class RegistrySnapshots {
  private readonly source: RegistrySnapshotSourcePort
  private readonly generations: RegistryGenerationStorePort
  private readonly maxAgeSeconds: number
  private readonly clock: () => Date
  private cached: RegistrySnapshot | undefined
  private reading: Promise<RegistrySnapshot | undefined> | undefined

  constructor(
    source: RegistrySnapshotSourcePort,
    generations: RegistryGenerationStorePort,
    maxAgeSeconds: number,
    clock: () => Date
  ) {
    this.source = source
    this.generations = generations
    this.maxAgeSeconds = maxAgeSeconds
    this.clock = clock
  }

  async current(): Promise<RegistrySnapshot | undefined> {
    const cached = this.cached

    if (cached !== undefined && this.clock().getTime() - cached.readAt.getTime() < this.maxAgeSeconds * 1000) {
      return cached
    }

    if (this.reading === undefined) {
      this.reading = this.read().finally(() => {
        this.reading = undefined
      })
    }

    return this.reading
  }

  private async read(): Promise<RegistrySnapshot | undefined> {
    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      this.cached = undefined

      return undefined
    }

    const state = await this.source.stateOf(active.contractAddress)

    this.cached = {
      generation: active.generation,
      networkId: active.networkId,
      contractAddress: active.contractAddress,
      state,
      readAt: this.clock()
    }

    return this.cached
  }
}

export default RegistrySnapshots
