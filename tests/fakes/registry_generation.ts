import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"

function registryGeneration(overrides: Partial<RegistryGeneration>): RegistryGeneration {
  return {
    generation: 1,
    contractAddress: "0201aa",
    networkId: "preprod",
    buildDigest: "b".repeat(64),
    status: "active",
    deployTxId: "00tx",
    anchorHeight: 3_201_705,
    anchorHash: "af827ca2b968799f27feb610211aedbf0e435cc83bb2b6411e8c90005bbd068c",
    ...overrides
  }
}

export { registryGeneration }
