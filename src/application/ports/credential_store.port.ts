import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { IssuanceRecord } from "../../types/issuance_record.type.ts"
import type { UnsettledIssuance } from "../../types/unsettled_issuance.type.ts"

interface CredentialStorePort {
  forDay(principalId: string, classId: Uint8Array, issueDay: number): Promise<CredentialRecord | undefined>
  record(credential: CredentialRecord): Promise<"recorded" | "conflict">
  byId(id: string): Promise<CredentialRecord | undefined>
  isCurrent(credential: CredentialRecord): Promise<boolean>
  issuanceOf(credentialId: string, generation: number): Promise<IssuanceRecord | undefined>
  queueCurrent(generation: number, at: Date): Promise<number>
  nextUnsettled(generation: number): Promise<UnsettledIssuance | undefined>
  markUncertain(credentialId: string, generation: number, leaf: Uint8Array, at: Date): Promise<void>
  markIssued(
    credentialId: string,
    generation: number,
    leafIndex: bigint,
    txId: string | undefined,
    at: Date
  ): Promise<void>
}

export type { CredentialStorePort }
