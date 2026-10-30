import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime"

import type { Ledger } from "#contracts/credential_registry/contract/index.js"
import { credentialRegistryWitnesses } from "../../../src/infrastructure/midnight/credential_registry_witnesses.ts"
import type { CredentialRegistryPrivateState } from "../../../src/types/credential_registry_private_state.type.ts"

const issuer: CredentialRegistryPrivateState = { role: "issuer", issuerSecret: new Uint8Array(32) }

const holder: CredentialRegistryPrivateState = {
  role: "holder",
  holderSecret: new Uint8Array(32),
  credential: { classId: new Uint8Array(32), attributes: [0n, 0n, 0n, 0n], salt: new Uint8Array(32) },
  leafIndex: 0n
}

function contextOf(
  privateState: CredentialRegistryPrivateState
): WitnessContext<Ledger, CredentialRegistryPrivateState> {
  return { privateState } as WitnessContext<Ledger, CredentialRegistryPrivateState>
}

describe("the credential registry witnesses", () => {
  it("give the issuer secret to the issuer only", () => {
    assert.deepEqual(credentialRegistryWitnesses.issuerSecret(contextOf(issuer))[1], issuer.issuerSecret)
    assert.throws(() => credentialRegistryWitnesses.issuerSecret(contextOf(holder)), /only the issuer/)
  })

  it("give a holder's secret, credential and path to a holder only", () => {
    assert.throws(() => credentialRegistryWitnesses.holderSecret(contextOf(issuer)), /only a holder/)
    assert.throws(() => credentialRegistryWitnesses.heldCredential(contextOf(issuer)), /only a holder/)
    assert.throws(
      () => credentialRegistryWitnesses.credentialPath(contextOf(issuer), new Uint8Array(32)),
      /only a holder/
    )
  })
})
