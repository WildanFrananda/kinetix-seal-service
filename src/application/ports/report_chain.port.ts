import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"
import type { RightLeafParts } from "../../types/right_leaf_parts.type.ts"

interface ReportChainPort {
  merchantTagOf(merchantPrincipalId: string): Uint8Array
  rightLeafOf(parts: RightLeafParts): Uint8Array
  grant(contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt>
  locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined>
}

export type { ReportChainPort }
