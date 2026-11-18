import type { SettleGenerationQueueOptions } from "../types/settle_generation_queue_options.type.ts"

async function settleGenerationQueue<T>(options: SettleGenerationQueueOptions<T>): Promise<void> {
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
