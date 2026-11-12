import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"

import type { ReportRegistryContract } from "./report_registry_contract.type.ts"

type ReportRegistryCircuitId = CompactContract.ProvableCircuitId<ReportRegistryContract>

export type { ReportRegistryCircuitId }
