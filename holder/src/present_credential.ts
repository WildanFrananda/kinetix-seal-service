import {
  type CallOptionsWithPrivateState,
  createUnprovenCallTxFromInitialStates
} from "@midnight-ntwrk/midnight-js-contracts"
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"
import { createProofProvider } from "@midnight-ntwrk/midnight-js-types"
import { provingProvider } from "@midnight-ntwrk/zkir-v2"

import type { RegistryContract } from "../../src/types/registry_contract.type.ts"
import type { HolderPresentation } from "../types/holder_presentation.type.ts"
import type HolderKeyMaterial from "./holder_key_material.ts"
import { compileHolderRegistry } from "./holder_registry_contract.ts"

const compiledContract = compileHolderRegistry()

async function presentCredential(
  presentation: HolderPresentation,
  keyMaterial: HolderKeyMaterial
): Promise<Uint8Array> {
  const { snapshot, holder, challenge, predicateId } = presentation

  setNetworkId(snapshot.networkId)

  const ephemeral = ZswapSecretKeys.fromSeed(crypto.getRandomValues(new Uint8Array(32)))
  const options = {
    compiledContract,
    circuitId: "present",
    contractAddress: snapshot.contractAddress,
    args: [challenge, predicateId],
    coinPublicKey: ephemeral.coinPublicKey,
    initialContractState: snapshot.contractState,
    initialZswapChainState: snapshot.zswapChainState,
    ledgerParameters: snapshot.ledgerParameters,
    initialPrivateState: holder
  } as CallOptionsWithPrivateState<RegistryContract, "present">

  const call = await createUnprovenCallTxFromInitialStates(keyMaterial, options, ephemeral.encryptionPublicKey)
  const proven = await createProofProvider(provingProvider(keyMaterial)).proveTx(call.private.unprovenTx)

  return proven.bind().serialize()
}

export { presentCredential }
