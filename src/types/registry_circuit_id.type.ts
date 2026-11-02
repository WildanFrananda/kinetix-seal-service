import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js"

import type { RegistryContract } from "./registry_contract.type.ts"

type RegistryCircuitId = CompactContract.ProvableCircuitId<RegistryContract>

export type { RegistryCircuitId }
