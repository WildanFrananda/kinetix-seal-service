import { createHash } from "node:crypto"

import type { PredicateChainPort } from "../../src/application/ports/predicate_chain.port.ts"
import { hexOf } from "../../src/domain/hex.ts"
import type { PlacedPredicate } from "../../src/types/placed_predicate.type.ts"
import type { RegistryPredicate } from "../../src/types/registry_predicate.type.ts"
import type { RegistryReceipt } from "../../src/types/registry_receipt.type.ts"

class FakePredicateChain implements PredicateChainPort {
  readonly onChain = new Map<string, PlacedPredicate>()
  readonly sent: string[] = []
  failOn: "approve" | "withdraw" | undefined

  predicateIdOf(predicate: RegistryPredicate): Uint8Array {
    return new Uint8Array(
      createHash("sha256")
        .update(`${hexOf(predicate.classId)}:${predicate.minimums.join(",")}`)
        .digest()
    )
  }

  async placed(_contractAddress: string): Promise<PlacedPredicate[]> {
    return [...this.onChain.values()]
  }

  async approve(_contractAddress: string, predicate: RegistryPredicate): Promise<RegistryReceipt> {
    const id = this.predicateIdOf(predicate)

    this.sent.push(`approve ${predicate.minimums.join(",")}`)

    if (this.failOn === "approve") {
      throw new Error("the proof server is down")
    }

    this.onChain.set(hexOf(id), { id, predicate })

    return { txId: `tx-${this.sent.length}` }
  }

  async withdraw(_contractAddress: string, id: Uint8Array): Promise<RegistryReceipt> {
    this.sent.push(`withdraw ${this.onChain.get(hexOf(id))?.predicate.minimums.join(",")}`)

    if (this.failOn === "withdraw") {
      throw new Error("the proof server is down")
    }

    this.onChain.delete(hexOf(id))

    return { txId: `tx-${this.sent.length}` }
  }

  place(predicate: RegistryPredicate): void {
    const id = this.predicateIdOf(predicate)

    this.onChain.set(hexOf(id), { id, predicate })
  }

  minimumsOnChain(): string[] {
    return [...this.onChain.values()].map((placement) => placement.predicate.minimums.join(",")).sort()
  }
}

export default FakePredicateChain
