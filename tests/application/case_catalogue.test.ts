import assert from "node:assert/strict"
import { describe, it } from "node:test"

import CaseCatalogue from "../../src/application/case_catalogue.service.ts"
import { hexOf } from "../../src/domain/hex.ts"
import { merchantTagOf } from "../../src/domain/merchant_tag.ts"
import FakeCaseStore from "../fakes/fake_case_store.ts"
import FakeMerchantInfo from "../fakes/fake_merchant_info.ts"

const issuerSecret = new Uint8Array(32).fill(0x2b)
const admin = { principalId: "adm_1", role: "admin" }
const merchantA = "11111111-1111-4111-8111-111111111111"
const merchantB = "22222222-2222-4222-8222-222222222222"

describe("the case catalogue", () => {
  it("refuses callers who are not admins", async () => {
    const catalogue = new CaseCatalogue({
      cases: new FakeCaseStore(),
      merchants: new FakeMerchantInfo(),
      issuerSecret
    })

    const listed = await catalogue.list({ principalId: "buy_1", role: "customer" })
    const detail = await catalogue.detail({ principalId: "buy_1", role: "customer" }, merchantA)

    assert.deepEqual(listed, { kind: "not_admin" })
    assert.deepEqual(detail, { kind: "not_admin" })
  })

  it("groups merchant cases newest-first and enriches them with identity profiles", async () => {
    const cases = new FakeCaseStore()
    const merchants = new FakeMerchantInfo()
    const tagA = hexOf(merchantTagOf(issuerSecret, merchantA))
    const tagB = hexOf(merchantTagOf(issuerSecret, merchantB))

    cases.tags.set(tagA, merchantA)
    cases.tags.set(tagB, merchantB)
    merchants.profiles.set(merchantA, { storeName: "Kedai Pertama", status: "verified" })

    cases.details.set(tagA, {
      merchantTag: tagA,
      confirmedCount: 1,
      pendingCount: 0,
      totalCount: 1,
      windowCount: 1,
      earliestWindow: 202610,
      latestWindow: 202610,
      firstReportedAt: new Date("2026-10-12T10:00:00Z"),
      latestReportedAt: new Date("2026-10-12T10:00:00Z"),
      categories: [{ slug: "fraud", label: "Fraud", count: 1 }],
      reports: []
    })

    cases.details.set(tagB, {
      merchantTag: tagB,
      confirmedCount: 1,
      pendingCount: 1,
      totalCount: 2,
      windowCount: 1,
      earliestWindow: 202611,
      latestWindow: 202611,
      firstReportedAt: new Date("2026-11-01T08:00:00Z"),
      latestReportedAt: new Date("2026-11-05T09:00:00Z"),
      categories: [{ slug: "counterfeit", label: "Counterfeit goods", count: 2 }],
      reports: []
    })

    const catalogue = new CaseCatalogue({ cases, merchants, issuerSecret })
    const outcome = await catalogue.list(admin)

    assert.equal(outcome.kind, "listed")

    if (outcome.kind !== "listed") {
      return
    }

    assert.deepEqual(
      outcome.cases.map((item) => item.merchantPrincipalId),
      [merchantB, merchantA]
    )

    assert.deepEqual(outcome.cases[0]?.merchant, { storeName: null, status: null })
    assert.deepEqual(outcome.cases[1]?.merchant, { storeName: "Kedai Pertama", status: "verified" })
  })

  it("looks up a merchant's reports by computing its HMAC merchant tag", async () => {
    const cases = new FakeCaseStore()
    const merchants = new FakeMerchantInfo()
    const tagA = hexOf(merchantTagOf(issuerSecret, merchantA))

    merchants.profiles.set(merchantA, { storeName: "Kedai Pertama", status: "suspended" })
    cases.details.set(tagA, {
      merchantTag: tagA,
      confirmedCount: 1,
      pendingCount: 1,
      totalCount: 2,
      windowCount: 1,
      earliestWindow: 202611,
      latestWindow: 202611,
      firstReportedAt: new Date("2026-11-01T08:00:00Z"),
      latestReportedAt: new Date("2026-11-02T08:00:00Z"),
      categories: [{ slug: "fraud", label: "Fraud", count: 2 }],
      reports: [
        {
          nullifier: "aa".repeat(32),
          category: { slug: "fraud", label: "Fraud" },
          body: "parcel never arrived",
          window: 202611,
          status: "confirmed",
          firstGeneration: 1,
          txId: "tx-1",
          submittedAt: new Date("2026-11-01T08:00:00Z"),
          confirmedAt: new Date("2026-11-01T08:05:00Z")
        },
        {
          nullifier: "bb".repeat(32),
          category: { slug: "fraud", label: "Fraud" },
          body: "wrong item in box",
          window: 202611,
          status: "submitted",
          firstGeneration: 1,
          txId: "tx-2",
          submittedAt: new Date("2026-11-02T08:00:00Z"),
          confirmedAt: undefined
        }
      ]
    })

    const catalogue = new CaseCatalogue({ cases, merchants, issuerSecret })
    const found = await catalogue.detail(admin, merchantA, "confirmed")
    const missing = await catalogue.detail(admin, merchantB, "all")

    assert.equal(missing.kind, "not_found")
    assert.equal(found.kind, "found")

    if (found.kind !== "found") {
      return
    }

    assert.equal(found.detail.confirmedCount, 1)
    assert.equal(found.detail.pendingCount, 1)
    assert.deepEqual(found.detail.merchant, { storeName: "Kedai Pertama", status: "suspended" })
    assert.equal(found.detail.reports.length, 1)
    assert.equal(found.detail.reports[0]?.nullifier, "aa".repeat(32))
  })
})
