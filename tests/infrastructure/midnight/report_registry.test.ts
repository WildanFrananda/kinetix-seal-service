import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, it } from "node:test"
import { Zkir } from "@midnightntwrk/zkir-v3"

import { pureCircuits as credentialCircuits } from "#contracts/credential_registry/contract/index.js"
import { type FiledReport, pureCircuits } from "#contracts/report_registry/contract/index.js"
import { reportRegistryDirectory } from "../../../src/infrastructure/midnight/report_registry_contract.ts"
import type { IssuerPrivateState } from "../../../src/types/issuer_private_state.type.ts"
import type { ReporterPrivateState } from "../../../src/types/reporter_private_state.type.ts"
import InMemoryReportRegistry from "./in_memory_report_registry.ts"

const november2026 = 682n

function padded(text: string): Uint8Array {
  const bytes = new Uint8Array(32)

  bytes.set(new TextEncoder().encode(text))

  return bytes
}

function digestOf(text: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(text).digest())
}

function newIssuer(): IssuerPrivateState {
  return { role: "issuer", issuerSecret: randomBytes(32) }
}

const merchant = new Uint8Array(randomBytes(32))
const otherMerchant = new Uint8Array(randomBytes(32))
const order = padded("ORD-20261108-8AA3A287")

async function grantTo(
  registry: InMemoryReportRegistry,
  issuer: IssuerPrivateState,
  right: { merchant: Uint8Array; window: bigint; order: Uint8Array },
  reporterSecret: Uint8Array = randomBytes(32)
): Promise<ReporterPrivateState> {
  const leafIndex = registry.ledger().rights.firstFree()
  const leaf = pureCircuits.rightLeaf(
    right.merchant,
    right.window,
    right.order,
    pureCircuits.reporterKey(reporterSecret)
  )

  await registry.grant(leaf, issuer)

  return { role: "reporter", reporterSecret, order: right.order, leafIndex }
}

async function registryWithRight(): Promise<{
  registry: InMemoryReportRegistry
  issuer: IssuerPrivateState
  reporter: ReporterPrivateState
}> {
  const issuer = newIssuer()
  const registry = await InMemoryReportRegistry.deploy(issuer.issuerSecret)
  const reporter = await grantTo(registry, issuer, { merchant, window: november2026, order })

  return { registry, issuer, reporter }
}

describe("the report registry contract", () => {
  it("keeps report small enough for a phone to prove in about a minute (SEAL-D11)", async () => {
    const zkir = Zkir.deserialize(await readFile(join(reportRegistryDirectory, "zkir", "report.bzkir")))

    assert.ok(zkir.getK() <= 12, `report is k=${zkir.getK()}`)
  })

  it("lets only the issuer grant a right", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryReportRegistry.deploy(issuer.issuerSecret)

    await grantTo(registry, issuer, { merchant, window: november2026, order })

    await assert.rejects(grantTo(registry, newIssuer(), { merchant, window: november2026, order }), /not the issuer/)
    assert.equal(registry.ledger().rights.firstFree(), 1n)
  })

  it("files a report under the merchant's tag, the window and the body's digest, keyed by its nullifier", async () => {
    const { registry, reporter } = await registryWithRight()
    const digest = digestOf("the parcel held a counterfeit")

    await registry.report(merchant, november2026, digest, reporter)

    const filed = registry.ledger().reports.lookup(pureCircuits.reportNullifier(reporter.reporterSecret, order))

    assert.deepEqual(filed, { merchant, window: november2026, digest })
    assert.equal(registry.ledger().reports.size(), 1n)
  })

  it("files one report per order and reporter", async () => {
    const { registry, reporter } = await registryWithRight()

    await registry.report(merchant, november2026, digestOf("first"), reporter)

    await assert.rejects(registry.report(merchant, november2026, digestOf("second"), reporter), /already reported/)
    assert.equal(registry.ledger().reports.size(), 1n)
  })

  it("lets the buyer and the courier of one order each file their own report", async () => {
    const { registry, issuer, reporter: buyer } = await registryWithRight()
    const courier = await grantTo(registry, issuer, { merchant, window: november2026, order })

    await registry.report(merchant, november2026, digestOf("from the buyer"), buyer)
    await registry.report(merchant, november2026, digestOf("from the courier"), courier)

    assert.equal(registry.ledger().reports.size(), 2n)
  })

  it("gives a reporter a separate report for each of its orders", async () => {
    const { registry, issuer, reporter } = await registryWithRight()
    const secondOrder = padded("ORD-20261109-1F00C0DE")
    const second = await grantTo(
      registry,
      issuer,
      { merchant, window: november2026, order: secondOrder },
      reporter.reporterSecret
    )

    await registry.report(merchant, november2026, digestOf("first order"), reporter)
    await registry.report(merchant, november2026, digestOf("second order"), second)

    assert.equal(registry.ledger().reports.size(), 2n)
    assert.notDeepEqual(
      pureCircuits.reportNullifier(reporter.reporterSecret, order),
      pureCircuits.reportNullifier(reporter.reporterSecret, secondOrder)
    )
  })

  it("refuses a report against another merchant or window than the right names", async () => {
    const { registry, reporter } = await registryWithRight()

    await assert.rejects(registry.report(otherMerchant, november2026, digestOf("x"), reporter), /was not granted/)
    await assert.rejects(registry.report(merchant, november2026 + 1n, digestOf("x"), reporter), /was not granted/)
    assert.equal(registry.ledger().reports.size(), 0n)
  })

  it("refuses an order the reporter was never granted", async () => {
    const { registry, reporter } = await registryWithRight()
    const forged: ReporterPrivateState = { ...reporter, order: padded("ORD-20261108-FFFFFFFF") }

    await assert.rejects(registry.report(merchant, november2026, digestOf("x"), forged), /was not granted/)
  })

  it("refuses a right granted to another reporter's key", async () => {
    const { registry, reporter } = await registryWithRight()
    const stranger: ReporterPrivateState = { ...reporter, reporterSecret: randomBytes(32) }

    await assert.rejects(registry.report(merchant, november2026, digestOf("x"), stranger), /was not granted/)
  })

  it("stops grants and reports while paused, and resumes them when unpaused", async () => {
    const { registry, issuer, reporter } = await registryWithRight()

    await registry.pause(issuer)

    await assert.rejects(grantTo(registry, issuer, { merchant, window: november2026, order }), /paused/i)
    await assert.rejects(registry.report(merchant, november2026, digestOf("x"), reporter), /paused/i)
    await assert.rejects(registry.unpause(newIssuer()), /not the issuer/)

    await registry.unpause(issuer)
    await registry.report(merchant, november2026, digestOf("x"), reporter)

    assert.equal(registry.ledger().reports.size(), 1n)
  })

  it("lets only the issuer seed a filed report into a new generation, even while paused", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryReportRegistry.deploy(issuer.issuerSecret)
    const nullifier = randomBytes(32)
    const filed: FiledReport = { merchant, window: november2026, digest: digestOf("carried over") }

    await assert.rejects(registry.seedReport(nullifier, filed, newIssuer()), /not the issuer/)

    await registry.pause(issuer)
    await registry.seedReport(nullifier, filed, issuer)

    assert.deepEqual(registry.ledger().reports.lookup(nullifier), filed)
    await assert.rejects(registry.seedReport(nullifier, filed, issuer), /already reported/)
  })

  it("refuses a report whose nullifier was seeded from an earlier generation", async () => {
    const { registry, issuer, reporter } = await registryWithRight()
    const nullifier = pureCircuits.reportNullifier(reporter.reporterSecret, order)

    await registry.seedReport(nullifier, { merchant, window: november2026, digest: digestOf("earlier") }, issuer)

    await assert.rejects(registry.report(merchant, november2026, digestOf("again"), reporter), /already reported/)
  })

  it("hands the issuer authority over in two steps", async () => {
    const issuer = newIssuer()
    const successor = newIssuer()
    const registry = await InMemoryReportRegistry.deploy(issuer.issuerSecret)

    await registry.proposeIssuer(pureCircuits.issuerPublicKey(successor.issuerSecret), issuer)
    await registry.acceptIssuer(successor)

    await assert.rejects(grantTo(registry, issuer, { merchant, window: november2026, order }), /not the issuer/)
    await grantTo(registry, successor, { merchant, window: november2026, order })

    assert.equal(registry.ledger().rights.firstFree(), 1n)
  })

  it("derives a reporter key that differs from a credential holder's key for the same secret", () => {
    const secret = randomBytes(32)

    assert.notEqual(pureCircuits.reporterKey(secret), credentialCircuits.holderPublicKey(secret))
    assert.equal(pureCircuits.reporterKey(secret), pureCircuits.reporterKey(Uint8Array.from(secret)))
  })
})
