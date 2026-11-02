import type { PlacedPredicate } from "../../types/placed_predicate.type.ts"
import type { RegistryPredicate } from "../../types/registry_predicate.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"

interface PredicateChainPort {
  predicateIdOf(predicate: RegistryPredicate): Uint8Array
  placed(contractAddress: string): Promise<PlacedPredicate[]>
  approve(contractAddress: string, predicate: RegistryPredicate): Promise<RegistryReceipt>
  withdraw(contractAddress: string, id: Uint8Array): Promise<RegistryReceipt>
}

export type { PredicateChainPort }
