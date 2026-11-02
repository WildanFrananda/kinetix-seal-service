import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"

interface CredentialChainPort {
  leafOf(credential: CredentialRecord): Uint8Array
  issue(contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt>
  locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined>
}

export type { CredentialChainPort }
