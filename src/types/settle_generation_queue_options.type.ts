import type { RegistryGenerationStorePort } from "../application/ports/registry_generation_store.port.ts"
import type { RegistryGeneration } from "./registry_generation.type.ts"

type SettleGenerationQueueOptions<T> = {
  generations: RegistryGenerationStorePort
  queue: (generation: number) => Promise<number>
  onQueued: (generation: number, count: number) => void
  nextUnsettled: (generation: number) => Promise<T | undefined>
  settleOne: (active: RegistryGeneration, item: T) => Promise<boolean>
}

export type { SettleGenerationQueueOptions }
