import type { Contract } from "#contracts/report_registry/contract/index.js"
import type { ReportRegistryPrivateState } from "./report_registry_private_state.type.ts"

type ReportRegistryContract = Contract<ReportRegistryPrivateState>

export type { ReportRegistryContract }
