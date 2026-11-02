import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { IssueReceipt } from "../../types/issue_receipt.type.ts"

interface CredentialChainPort {
  leafOf(credential: CredentialRecord): Uint8Array
  issue(contractAddress: string, leaf: Uint8Array): Promise<IssueReceipt>
  locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined>
}

export type { CredentialChainPort }
