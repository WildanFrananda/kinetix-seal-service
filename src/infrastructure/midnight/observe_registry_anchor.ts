import type { PublicDataProvider } from "@midnight-ntwrk/midnight-js-types"

import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import type IndexerBlocks from "./indexer_blocks.ts"

async function observeRegistryAnchor(
  blocks: IndexerBlocks,
  publicData: PublicDataProvider,
  networkStepSeconds: number,
  generation: RegistryGeneration
): Promise<AnchorObservation> {
  if (generation.anchorHeight === undefined || generation.anchorHash === undefined) {
    return "unknown"
  }

  const hash = await blocks.hashAt(generation.anchorHeight)

  if (hash !== undefined) {
    return hash === generation.anchorHash ? "unchanged" : "replaced"
  }

  const [tip, state] = await Promise.all([
    blocks.tipHeight(),
    withTimeout(publicData.queryContractState(generation.contractAddress), networkStepSeconds, "reading the registry")
  ])

  return tip < generation.anchorHeight && state === null ? "replaced" : "unknown"
}

export { observeRegistryAnchor }
