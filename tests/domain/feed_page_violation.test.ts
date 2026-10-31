import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { feedPageViolation } from "../../src/domain/feed_page_violation.ts"
import { compareCursors } from "../../src/domain/log_cursor.ts"

function at(transactionId: number, sequence: number) {
  return { transactionId: BigInt(transactionId), sequence: BigInt(sequence) }
}

function record(transactionId: number, sequence: number) {
  return { position: at(transactionId, sequence) }
}

describe("a fact feed page", () => {
  it("orders cursors by transaction, then by sequence", () => {
    assert.equal(compareCursors(at(1, 9), at(2, 0)), -1)
    assert.equal(compareCursors(at(2, 1), at(2, 0)), 1)
    assert.equal(compareCursors(at(2, 1), at(2, 1)), 0)
  })

  it("is valid when positions rise past the cursor and next is the last one", () => {
    const page = { records: [record(5, 1), record(5, 2), record(6, 0)], next: at(6, 0), hasMore: true }

    assert.equal(feedPageViolation(at(4, 9), 3, page), undefined)
  })

  it("is valid empty when it keeps the cursor and claims nothing more", () => {
    assert.equal(feedPageViolation(at(4, 9), 3, { records: [], next: at(4, 9), hasMore: false }), undefined)
  })

  it("refuses more records than were asked for", () => {
    const page = { records: [record(5, 1), record(5, 2)], next: at(5, 2), hasMore: false }

    assert.match(feedPageViolation(at(4, 9), 1, page) ?? "", /against a limit of 1/)
  })

  it("refuses a record at or before the cursor, or out of order", () => {
    assert.match(
      feedPageViolation(at(5, 1), 3, { records: [record(5, 1)], next: at(5, 1), hasMore: false }) ?? "",
      /do not increase/
    )
    assert.match(
      feedPageViolation(at(4, 0), 3, { records: [record(5, 2), record(5, 1)], next: at(5, 1), hasMore: false }) ?? "",
      /do not increase/
    )
  })

  it("refuses a next cursor that is not the last record's position", () => {
    assert.match(
      feedPageViolation(at(4, 0), 3, { records: [record(5, 2)], next: at(6, 0), hasMore: false }) ?? "",
      /not the last record/
    )
  })

  it("refuses an empty page that moves the cursor, or claims there is more", () => {
    assert.match(feedPageViolation(at(4, 0), 3, { records: [], next: at(5, 0), hasMore: false }) ?? "", /moved/)
    assert.match(feedPageViolation(at(4, 0), 3, { records: [], next: at(4, 0), hasMore: true }) ?? "", /more/)
  })
})
