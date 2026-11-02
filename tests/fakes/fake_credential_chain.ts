import type { CredentialChainPort } from "../../src/application/ports/credential_chain.port.ts"
import type { CredentialRecord } from "../../src/types/credential_record.type.ts"
import type { RegistryReceipt } from "../../src/types/registry_receipt.type.ts"

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

class FakeCredentialChain implements CredentialChainPort {
  readonly tree: string[] = []
  readonly submitted: string[] = []
  issueFails: Error | undefined
  landsDespiteFailure = false
  locateFails: Error | undefined

  leafOf(credential: CredentialRecord): Uint8Array {
    const leaf = new Uint8Array(32)

    leaf.set(Buffer.from(credential.id.replaceAll("-", ""), "hex"))

    return leaf
  }

  async issue(_contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt> {
    this.submitted.push(hexOf(leaf))

    if (this.issueFails !== undefined) {
      if (this.landsDespiteFailure) {
        this.tree.push(hexOf(leaf))
      }

      throw this.issueFails
    }

    this.tree.push(hexOf(leaf))

    return { txId: `tx-${this.tree.length}` }
  }

  async locate(_contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    if (this.locateFails !== undefined) {
      throw this.locateFails
    }

    const index = this.tree.indexOf(hexOf(leaf))

    return index < 0 ? undefined : BigInt(index)
  }
}

export default FakeCredentialChain
