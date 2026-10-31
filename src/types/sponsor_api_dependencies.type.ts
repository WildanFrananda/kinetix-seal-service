import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { SponsorStateSourcePort } from "../application/ports/sponsor_state_source.port.ts"
import type { TransactionPayerPort } from "../application/ports/transaction_payer.port.ts"
import type { MeshIdentity } from "./mesh_identity.type.ts"

type SponsorApiDependencies = {
  identity: MeshIdentity
  state: SponsorStateSourcePort
  payer: TransactionPayerPort
  logger: LoggerPort
}

export type { SponsorApiDependencies }
