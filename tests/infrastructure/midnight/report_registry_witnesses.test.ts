import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime"

import type { Ledger } from "#contracts/report_registry/contract/index.js"
import { reportRegistryWitnesses } from "../../../src/infrastructure/midnight/report_registry_witnesses.ts"
import type { ReportRegistryPrivateState } from "../../../src/types/report_registry_private_state.type.ts"

const issuer: ReportRegistryPrivateState = { role: "issuer", issuerSecret: new Uint8Array(32) }

const reporter: ReportRegistryPrivateState = {
  role: "reporter",
  reporterSecret: new Uint8Array(32),
  order: new Uint8Array(32),
  leafIndex: 0n
}

function contextOf(privateState: ReportRegistryPrivateState): WitnessContext<Ledger, ReportRegistryPrivateState> {
  return { privateState } as WitnessContext<Ledger, ReportRegistryPrivateState>
}

describe("the report registry witnesses", () => {
  it("give the issuer secret to the issuer only", () => {
    assert.deepEqual(reportRegistryWitnesses.issuerSecret(contextOf(issuer))[1], issuer.issuerSecret)
    assert.throws(() => reportRegistryWitnesses.issuerSecret(contextOf(reporter)), /only the issuer/)
  })

  it("give a reporter's secret, order and path to a reporter only", () => {
    assert.deepEqual(reportRegistryWitnesses.reporterSecret(contextOf(reporter))[1], reporter.reporterSecret)
    assert.deepEqual(reportRegistryWitnesses.heldOrder(contextOf(reporter))[1], reporter.order)
    assert.throws(() => reportRegistryWitnesses.reporterSecret(contextOf(issuer)), /only a reporter/)
    assert.throws(() => reportRegistryWitnesses.heldOrder(contextOf(issuer)), /only a reporter/)
    assert.throws(() => reportRegistryWitnesses.rightPath(contextOf(issuer), new Uint8Array(32)), /only a reporter/)
  })
})
