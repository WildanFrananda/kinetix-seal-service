import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"

import { type Ledger, ledger, pureCircuits } from "#contracts/report_registry/contract/index.js"
import type { ReportChainPort } from "../../application/ports/report_chain.port.ts"
import { merchantTagOf } from "../../domain/merchant_tag.ts"
import type { MidnightCredentialChainDependencies } from "../../types/midnight_credential_chain_dependencies.type.ts"
import type { OnChainFiledReport } from "../../types/on_chain_filed_report.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"
import type { ReportRegistryCircuitId } from "../../types/report_registry_circuit_id.type.ts"
import type { ReportRegistryContract } from "../../types/report_registry_contract.type.ts"
import type { RightLeafParts } from "../../types/right_leaf_parts.type.ts"
import { issuedLeafIndex } from "./issued_leaf_index.ts"
import { callRegistryCircuit, readContractLedger } from "./registry_circuit_client.ts"
import { compileReportRegistry } from "./report_registry_contract.ts"

const compiledContract = compileReportRegistry()
const registryLabel = "the report registry"

class MidnightReportChain implements ReportChainPort {
  private readonly dependencies: MidnightCredentialChainDependencies

  constructor(dependencies: MidnightCredentialChainDependencies) {
    this.dependencies = dependencies
  }

  merchantTagOf(merchantPrincipalId: string): Uint8Array {
    return merchantTagOf(this.dependencies.issuerSecret, merchantPrincipalId)
  }

  rightLeafOf(parts: RightLeafParts): Uint8Array {
    return pureCircuits.rightLeaf(parts.merchantTag, BigInt(parts.window), parts.order, parts.reporterKey)
  }

  async grant(contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt> {
    return this.call(contractAddress, "grant", [leaf], "a report right's grant")
  }

  async locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    return issuedLeafIndex((await this.registryLedger(contractAddress)).rights, leaf)
  }

  async hasReport(contractAddress: string, nullifier: Uint8Array): Promise<boolean> {
    return (await this.registryLedger(contractAddress)).reports.member(nullifier)
  }

  async filedReports(contractAddress: string): Promise<OnChainFiledReport[]> {
    const entries: OnChainFiledReport[] = []
    const current = await this.registryLedger(contractAddress)

    for (const [nullifier, value] of current.reports) {
      entries.push({
        nullifier: Uint8Array.from(nullifier),
        merchantTag: Uint8Array.from(value.merchant),
        window: value.window,
        digest: Uint8Array.from(value.digest)
      })
    }

    return entries
  }

  async seedReport(contractAddress: string, report: OnChainFiledReport): Promise<RegistryReceipt> {
    return this.call(
      contractAddress,
      "seedReport",
      [report.nullifier, { merchant: report.merchantTag, window: report.window, digest: report.digest }],
      "seeding a confirmed report into the report registry"
    )
  }

  private async registryLedger(contractAddress: string): Promise<Ledger> {
    return readContractLedger(this.dependencies, contractAddress, (data) => ledger(data as never), registryLabel)
  }

  private async call<K extends ReportRegistryCircuitId>(
    contractAddress: string,
    circuitId: K,
    args: CompactContract.CircuitParameters<ReportRegistryContract, K>,
    what: string
  ): Promise<RegistryReceipt> {
    return callRegistryCircuit<ReportRegistryContract, K>({
      dependencies: this.dependencies,
      compiledContract,
      contractAddress,
      circuitId,
      args,
      label: registryLabel,
      what
    })
  }
}

export default MidnightReportChain
