import {
  createUnprovenCallTxFromInitialStates,
  type Ledger9CallOptionsWithPrivateState
} from "@midnight-ntwrk/midnight-js-contracts"
import { Transaction, ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"
import { createLedger9ProofProvider } from "@midnight-ntwrk/midnight-js-types"
import { provingProvider } from "@midnightntwrk/zkir-v3"

import type { RegistryContract } from "../../src/types/registry_contract.type.ts"
import type { HolderPresentation } from "../types/holder_presentation.type.ts"
import type HolderKeyMaterial from "./holder_key_material.ts"
import { compileHolderRegistry } from "./holder_registry_contract.ts"

const compiledContract = compileHolderRegistry()
const presentationTtlSeconds = 3600

async function presentCredential(
  presentation: HolderPresentation,
  keyMaterial: HolderKeyMaterial
): Promise<Uint8Array> {
  const { snapshot, holder, challenge, predicateId } = presentation
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
    initialPrivateState: holder,
    config: { networkId: snapshot.networkId, ttlSeconds: presentationTtlSeconds }
  } as Ledger9CallOptionsWithPrivateState<RegistryContract, "present">

  const call = await createUnprovenCallTxFromInitialStates(keyMaterial, options, ephemeral.encryptionPublicKey)
  const proven = await createLedger9ProofProvider(provingProvider(keyMaterial)).proveTx(call.private.unprovenTx)

  return proven.deserialize({ v9: Transaction }).bind().serialize()
}

export { presentCredential }
