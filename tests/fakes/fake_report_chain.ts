import { createHash } from "node:crypto"

import type { ReportChainPort } from "../../src/application/ports/report_chain.port.ts"
import { hexOf } from "../../src/domain/hex.ts"
import type { RegistryReceipt } from "../../src/types/registry_receipt.type.ts"
import type { RightLeafParts } from "../../src/types/right_leaf_parts.type.ts"

class FakeReportChain implements ReportChainPort {
  readonly granted: string[] = []
  grantFails: Error | undefined
  landsWithoutAnswer = false

  merchantTagOf(merchantPrincipalId: string): Uint8Array {
    return new Uint8Array(createHash("sha256").update(`tag:${merchantPrincipalId}`).digest())
  }

  rightLeafOf(parts: RightLeafParts): Uint8Array {
    return new Uint8Array(
      createHash("sha256")
        .update(hexOf(parts.merchantTag))
        .update(String(parts.window))
        .update(parts.order)
        .update(parts.reporterKey.toString())
        .digest()
    )
  }

  async grant(_contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt> {
    if (this.landsWithoutAnswer) {
      this.granted.push(hexOf(leaf))

      throw new Error("confirming a report right's grant timed out after 300 s")
    }

    if (this.grantFails !== undefined) {
      throw this.grantFails
    }

    this.granted.push(hexOf(leaf))

    return { txId: `00gr${this.granted.length}` }
  }

  async locate(_contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    const index = this.granted.indexOf(hexOf(leaf))

    return index === -1 ? undefined : BigInt(index)
  }
}

export default FakeReportChain
