import type { CredentialRecord } from "./credential_record.type.ts"

type CredentialRequestOutcome =
  | { kind: "accepted"; credential: CredentialRecord }
  | { kind: "existing"; credential: CredentialRecord }
  | { kind: "not_a_courier" }
  | { kind: "facts_stale" }
  | { kind: "no_deliveries" }
  | { kind: "issued_today" }

export type { CredentialRequestOutcome }
