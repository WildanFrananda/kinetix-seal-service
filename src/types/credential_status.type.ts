import type { CredentialPlacement } from "./credential_placement.type.ts"
import type { CredentialRecord } from "./credential_record.type.ts"
import type { CredentialStanding } from "./credential_standing.type.ts"

type CredentialStatus = {
  credential: CredentialRecord
  standing: CredentialStanding
  placement: CredentialPlacement | undefined
}

export type { CredentialStatus }
