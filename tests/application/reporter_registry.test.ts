import assert from "node:assert/strict"
import { describe, it } from "node:test"

import ReporterRegistry from "../../src/application/reporter_registry.service.ts"
import FakeReporterStore from "../fakes/fake_reporter_store.ts"
import RecordingReportMetrics from "../fakes/recording_report_metrics.ts"

const at = new Date("2026-11-12T05:00:00Z")
const courier = { principalId: "drv_1", role: "courier" }

function registryWith() {
  const store = new FakeReporterStore()
  const metrics = new RecordingReportMetrics()

  return { store, metrics, registry: new ReporterRegistry(store, metrics) }
}

describe("registering a reporter key", () => {
  it("keeps a courier's key and a buyer's key, each under its role", async () => {
    const { store, registry } = registryWith()

    const first = await registry.register(courier, 11n, at)
    const buyer = await registry.register({ principalId: "buy_1", role: "customer" }, 12n, at)

    assert.equal(first.kind, "registered")
    assert.equal(buyer.kind === "registered" ? buyer.reporter.role : undefined, "buyer")
    assert.deepEqual(
      store.rows.map((row) => [row.principalId, row.role, row.reporterKey]),
      [
        ["drv_1", "courier", 11n],
        ["buy_1", "buyer", 12n]
      ]
    )
  })

  it("answers a repeat with the same key as the same registration", async () => {
    const { store, registry } = registryWith()

    await registry.register(courier, 11n, at)

    const again = await registry.register(courier, 11n, new Date(at.getTime() + 60_000))

    assert.equal(again.kind, "existing")
    assert.equal(store.rows.length, 1)
  })

  it("refuses a key another account holds, and a role that reports nobody", async () => {
    const { registry, metrics } = registryWith()

    await registry.register(courier, 11n, at)

    assert.equal((await registry.register({ principalId: "drv_2", role: "courier" }, 11n, at)).kind, "key_taken")
    assert.equal((await registry.register({ principalId: "sel_1", role: "seller" }, 13n, at)).kind, "not_a_reporter")
    assert.deepEqual(metrics.registrations, ["registered", "key_taken", "not_a_reporter"])
  })

  it("reads a key that raced it in, and answers by its owner", async () => {
    const { store, registry } = registryWith()

    store.racedBy = { id: "r-0", principalId: "drv_2", role: "courier", reporterKey: 11n, registeredAt: at }

    assert.equal((await registry.register(courier, 11n, at)).kind, "key_taken")
  })
})
