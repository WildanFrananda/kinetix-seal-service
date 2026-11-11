import type { IssuerPrivateState } from "./issuer_private_state.type.ts"
import type { ReporterPrivateState } from "./reporter_private_state.type.ts"

type ReportRegistryPrivateState = IssuerPrivateState | ReporterPrivateState

export type { ReportRegistryPrivateState }
