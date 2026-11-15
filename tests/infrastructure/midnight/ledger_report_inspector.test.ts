import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { pureCircuits } from "#contracts/report_registry/contract/index.js"
import LedgerReportInspector from "../../../src/infrastructure/midnight/ledger_report_inspector.ts"
import InMemoryReportRegistry from "./in_memory_report_registry.ts"

describe("inspecting a proven report transaction", () => {
  it("extracts the nullifier, merchant tag, window, and digest from a proven, bound report call", async () => {
    const issuerSecret = new Uint8Array(32).fill(1)
    const reporterSecret = new Uint8Array(32).fill(2)
    const merchant = new Uint8Array(32).fill(3)
    const order = new Uint8Array(32).fill(5)
    const digest = new Uint8Array(32).fill(4)
    const window = 682n

    const registry = await InMemoryReportRegistry.deploy(issuerSecret)
    const leafIndex = registry.ledger().rights.firstFree()
    const leaf = pureCircuits.rightLeaf(merchant, window, order, pureCircuits.reporterKey(reporterSecret))

    await registry.grant(leaf, { role: "issuer", issuerSecret })

    const boundBytes = await registry.proveReport(merchant, window, digest, {
      role: "reporter",
      reporterSecret,
      order,
      leafIndex
    })

    const inspected = new LedgerReportInspector().inspect(boundBytes)
    const expectedNullifier = pureCircuits.reportNullifier(reporterSecret, order)

    assert.deepEqual(inspected, {
      calls: [
        {
          address: registry.contractAddress(),
          entryPoint: "report",
          nullifier: expectedNullifier,
          merchantTag: merchant,
          window,
          digest
        }
      ],
      otherActions: 0,
      offers: 0
    })

    assert.equal(new LedgerReportInspector().inspect(Uint8Array.from([0, 1, 2, 3])), undefined)
  })
})
