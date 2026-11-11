import assert from "node:assert/strict"
import { describe, it } from "node:test"

import HolderRuntime from "../../../holder/src/holder_runtime.ts"
import { presentationFault } from "../../../src/domain/presentation_shape.ts"
import LedgerPresentationInspector from "../../../src/infrastructure/midnight/ledger_presentation_inspector.ts"
import { fileAsset } from "../../holder/file_assets.ts"
import { presentationRequest } from "../../holder/holder_presentations.ts"

describe("inspecting what a verifier relays", () => {
  it("reads a holder's proven, bound present call as a presentation on its registry", async () => {
    const { registry, request } = await presentationRequest(20_725)
    const transaction = Buffer.from(await new HolderRuntime(fileAsset).present(request), "hex")
    const inspected = new LedgerPresentationInspector().inspect(transaction)

    assert.deepEqual(inspected, {
      calls: [{ address: registry.contractAddress(), entryPoint: "present" }],
      otherActions: 0,
      offers: 0
    })

    assert.ok(inspected !== undefined)
    assert.equal(presentationFault(inspected, registry.contractAddress()), undefined)
  })

  it("reads nothing from bytes that are not a transaction", () => {
    assert.equal(new LedgerPresentationInspector().inspect(Uint8Array.from([0, 1, 2, 3])), undefined)
  })
})
