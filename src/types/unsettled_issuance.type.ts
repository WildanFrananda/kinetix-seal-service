import type { CredentialRecord } from "./credential_record.type.ts"
import type { IssuanceRecord } from "./issuance_record.type.ts"

type UnsettledIssuance = {
  issuance: IssuanceRecord
  credential: CredentialRecord
}

export type { UnsettledIssuance }
