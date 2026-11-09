import type { RegistryDrillOutcome } from "../types/registry_drill_outcome.type.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"

const drillableNetworks: readonly string[] = ["preprod", "preview", "undeployed"]

class RegistryDrill {
  private readonly store: RegistryGenerationStorePort

  constructor(store: RegistryGenerationStorePort) {
    this.store = store
  }

  async retire(generation: number): Promise<RegistryDrillOutcome> {
    const active = (await this.store.unretired()).find((row) => row.status === "active")

    if (active === undefined) {
      return { kind: "refused", reason: "no_active_generation", activeGeneration: undefined }
    }

    if (!drillableNetworks.includes(active.networkId)) {
      return { kind: "refused", reason: "network_not_drillable", activeGeneration: active.generation }
    }

    if (active.generation !== generation) {
      return { kind: "refused", reason: "not_the_active_generation", activeGeneration: active.generation }
    }

    await this.store.retire({ generation, reason: "drill" })

    return { kind: "retired", generation, networkId: active.networkId }
  }
}

export default RegistryDrill
