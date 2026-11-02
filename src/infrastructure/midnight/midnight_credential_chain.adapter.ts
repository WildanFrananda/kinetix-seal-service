import { randomBytes } from "node:crypto"
import { createUnprovenCallTxFromInitialStates, getPublicStates } from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"

import { ledger } from "#contracts/credential_registry/contract/index.js"
import type { CredentialChainPort } from "../../application/ports/credential_chain.port.ts"
import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { IssueReceipt } from "../../types/issue_receipt.type.ts"
import type { MidnightCredentialChainDependencies } from "../../types/midnight_credential_chain_dependencies.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import { credentialLeafOf } from "./credential_leaf.ts"
import { compileCredentialRegistry } from "./credential_registry_contract.ts"
import { issuedLeafIndex } from "./issued_leaf_index.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

const compiledContract = compileCredentialRegistry()

class MidnightCredentialChain implements CredentialChainPort {
  private readonly dependencies: MidnightCredentialChainDependencies

  constructor(dependencies: MidnightCredentialChainDependencies) {
    this.dependencies = dependencies
  }

  leafOf(credential: CredentialRecord): Uint8Array {
    return credentialLeafOf(credential)
  }

  async issue(contractAddress: string, leaf: Uint8Array): Promise<IssueReceipt> {
    const { zkConfig, issuerSecret, publicData, networkStepSeconds } = this.dependencies
    const states = await withTimeout(
      getPublicStates(publicData, contractAddress),
      networkStepSeconds,
      "reading the registry"
    )
    const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
    const call = await createUnprovenCallTxFromInitialStates(
      zkConfig,
      {
        compiledContract,
        circuitId: "issue",
        contractAddress,
        args: [leaf],
        coinPublicKey: zswap.coinPublicKey,
        initialContractState: states.contractState,
        initialZswapChainState: states.zswapChainState,
        ledgerParameters: states.ledgerParameters,
        initialPrivateState: { role: "issuer", issuerSecret }
      },
      zswap.encryptionPublicKey
    )
    const confirmed = await submitSealTransaction(this.dependencies, call.private.unprovenTx, "an issue")

    return { txId: confirmed.txId }
  }

  async locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    const { publicData, networkStepSeconds } = this.dependencies
    const state = await withTimeout(
      publicData.queryContractState(contractAddress),
      networkStepSeconds,
      "reading the registry"
    )

    if (state === null) {
      throw new Error(`the registry ${contractAddress} has no state`)
    }

    return issuedLeafIndex(ledger(state.data).issued, leaf)
  }
}

export default MidnightCredentialChain
