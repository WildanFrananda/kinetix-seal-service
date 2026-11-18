import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"

async function settleGenerationQueue<T>(options: {
  generations: RegistryGenerationStorePort
  queue: (generation: number) => Promise<number>
  onQueued: (generation: number, count: number) => void
  nextUnsettled: (generation: number) => Promise<T | undefined>
  settleOne: (active: RegistryGeneration, item: T) => Promise<boolean>
}): Promise<void> {
  const active = (await options.generations.unretired()).find((generation) => generation.status === "active")

  if (active === undefined) {
    return
  }

  const queued = await options.queue(active.generation)

  if (queued > 0) {
    options.onQueued(active.generation, queued)
  }

  for (;;) {
    const next = await options.nextUnsettled(active.generation)

    if (next === undefined || !(await options.settleOne(active, next))) {
      return
    }
  }
}

export { settleGenerationQueue }
