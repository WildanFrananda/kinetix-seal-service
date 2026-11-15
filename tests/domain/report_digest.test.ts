import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isReportBodyValid, reportDigestOf } from "../../src/domain/report_digest.ts"

describe("report digest and body rules", () => {
  it("computes a domain-separated SHA-256 digest binding category, body, and salt", () => {
    const salt = new Uint8Array(32).fill(0x2a)
    const first = reportDigestOf("counterfeit", "knockoff shoes delivered", salt)
    const repeat = reportDigestOf("counterfeit", "knockoff shoes delivered", salt)

    assert.equal(first.length, 32)
    assert.deepEqual(first, repeat)

    assert.notDeepEqual(first, reportDigestOf("fraud", "knockoff shoes delivered", salt))
    assert.notDeepEqual(first, reportDigestOf("counterfeit", "different body", salt))
    assert.notDeepEqual(first, reportDigestOf("counterfeit", "knockoff shoes delivered", new Uint8Array(32).fill(0x2b)))
  })

  it("refuses a salt whose length is not 32 bytes", () => {
    assert.throws(() => reportDigestOf("fraud", "body", new Uint8Array(16)), /32 bytes/)
  })

  it("validates report body bounds", () => {
    assert.equal(isReportBodyValid(""), false)
    assert.equal(isReportBodyValid("   \n\t "), false)
    assert.equal(isReportBodyValid("valid evidence"), true)
    assert.equal(isReportBodyValid("a".repeat(4000)), true)
    assert.equal(isReportBodyValid("a".repeat(4001)), false)
  })
})
