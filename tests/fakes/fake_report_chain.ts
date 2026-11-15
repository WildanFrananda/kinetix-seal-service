import { createHash } from "node:crypto"

import type { ReportChainPort } from "../../src/application/ports/report_chain.port.ts"
import { hexOf } from "../../src/domain/hex.ts"
import type { OnChainFiledReport } from "../../src/types/on_chain_filed_report.type.ts"
import type { RegistryReceipt } from "../../src/types/registry_receipt.type.ts"
import type { RightLeafParts } from "../../src/types/right_leaf_parts.type.ts"

class FakeReportChain implements ReportChainPort {
  readonly granted: string[] = []
  readonly seeded: { contractAddress: string; nullifier: string }[] = []
  private readonly reports = new Map<string, OnChainFiledReport[]>()
  grantFails: Error | undefined
  queryFails: Error | undefined
  seedFails: Error | undefined
  landsWithoutAnswer = false
  landsSeedWithoutAnswer = false

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

  recordOnChainReport(contractAddress: string, report: OnChainFiledReport): void {
    const existing = this.reports.get(contractAddress) ?? []
    const nullifierHex = hexOf(report.nullifier)

    if (!existing.some((item) => hexOf(item.nullifier) === nullifierHex)) {
      existing.push(report)
      this.reports.set(contractAddress, existing)
    }
  }

  async hasReport(contractAddress: string, nullifier: Uint8Array): Promise<boolean> {
    if (this.queryFails !== undefined) {
      throw this.queryFails
    }

    const existing = this.reports.get(contractAddress) ?? []
    const nullifierHex = hexOf(nullifier)

    return existing.some((item) => hexOf(item.nullifier) === nullifierHex)
  }

  async filedReports(contractAddress: string): Promise<OnChainFiledReport[]> {
    if (this.queryFails !== undefined) {
      throw this.queryFails
    }

    return [...(this.reports.get(contractAddress) ?? [])]
  }

  async seedReport(contractAddress: string, report: OnChainFiledReport): Promise<RegistryReceipt> {
    if (this.landsSeedWithoutAnswer) {
      this.recordOnChainReport(contractAddress, report)
      this.seeded.push({ contractAddress, nullifier: hexOf(report.nullifier) })

      throw new Error("confirming a report seed timed out after 300 s")
    }

    if (this.seedFails !== undefined) {
      throw this.seedFails
    }

    this.recordOnChainReport(contractAddress, report)
    this.seeded.push({ contractAddress, nullifier: hexOf(report.nullifier) })

    return { txId: `00sd${this.seeded.length}` }
  }
}

export default FakeReportChain
