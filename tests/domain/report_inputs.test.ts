import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { merchantTagOf } from "../../src/domain/merchant_tag.ts"
import { reportOrderOf } from "../../src/domain/report_order.ts"
import { reportWindowOf } from "../../src/domain/report_window.ts"
import { reporterRoleOf } from "../../src/domain/reporter_role.ts"

describe("a report window", () => {
  it("is the calendar month in UTC, counted from January 1970", () => {
    assert.equal(reportWindowOf(new Date("1970-01-31T23:59:59Z")), 0)
    assert.equal(reportWindowOf(new Date("2026-11-08T10:00:00Z")), 682)
    assert.equal(reportWindowOf(new Date("2026-11-30T23:59:59Z")), 682)
    assert.equal(reportWindowOf(new Date("2026-12-01T00:00:00Z")), 683)
  })

  it("follows UTC, not the local day", () => {
    assert.equal(reportWindowOf(new Date("2026-11-30T23:30:00-01:00")), 683)
  })
})

describe("an order on chain", () => {
  it("is its number in UTF-8, padded to 32 bytes", () => {
    const order = reportOrderOf("ORD-20261108-8AA3A287")

    assert.equal(order.length, 32)
    assert.equal(new TextDecoder().decode(order.subarray(0, 21)), "ORD-20261108-8AA3A287")
    assert.ok(order.subarray(21).every((byte) => byte === 0))
  })

  it("refuses a number that does not fit, and an empty one", () => {
    assert.throws(() => reportOrderOf("O".repeat(33)), /does not fit in 32 bytes/)
    assert.throws(() => reportOrderOf(""), /does not fit in 32 bytes/)
  })
})

describe("a merchant tag", () => {
  const secret = new Uint8Array(32).fill(3)

  it("is the same for one merchant and one issuer secret, so reports group by merchant", () => {
    assert.deepEqual(merchantTagOf(secret, "mer_1"), merchantTagOf(secret, "mer_1"))
    assert.equal(merchantTagOf(secret, "mer_1").length, 32)
  })

  it("differs per merchant and per issuer secret, and does not carry the principal", () => {
    const tag = merchantTagOf(secret, "mer_1")

    assert.notDeepEqual(tag, merchantTagOf(secret, "mer_2"))
    assert.notDeepEqual(tag, merchantTagOf(new Uint8Array(32).fill(4), "mer_1"))
    assert.ok(!Buffer.from(tag).toString("utf8").includes("mer_1"))
  })
})

describe("a reporter's role", () => {
  it("is buyer for a customer and courier for a courier, and nothing for anyone else", () => {
    assert.equal(reporterRoleOf("customer"), "buyer")
    assert.equal(reporterRoleOf("courier"), "courier")
    assert.equal(reporterRoleOf("seller"), undefined)
    assert.equal(reporterRoleOf("admin"), undefined)
  })
})
