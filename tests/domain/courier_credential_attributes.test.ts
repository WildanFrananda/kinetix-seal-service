import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { courierAttributes } from "../../src/domain/courier_credential_attributes.ts"
import { issueDayOf } from "../../src/domain/issue_day.ts"

const issueDay = issueDayOf(new Date("2026-11-02T03:00:00Z"))

describe("a courier credential's attributes", () => {
  it("counts the day as whole days since the epoch, in UTC", () => {
    assert.equal(issueDay, 20_759)
    assert.equal(issueDayOf(new Date("2026-11-02T23:59:59.999Z")), 20_759)
    assert.equal(issueDayOf(new Date("2026-11-03T00:00:00Z")), 20_760)
  })

  it("states deliveries, the rating in hundredths, the days since the first delivery and the issue day", () => {
    const attributes = courierAttributes(
      { deliveries: 512, firstDeliveredAt: new Date("2026-03-01T08:00:00Z"), reviews: 3, ratingSum: 14 },
      issueDay
    )

    assert.deepEqual(attributes, [512n, 466n, 246n, 20_759n])
  })

  it("rounds the rating down, so it never claims more than was earned", () => {
    const [, rating] =
      courierAttributes(
        { deliveries: 1, firstDeliveredAt: new Date("2026-11-01T00:00:00Z"), reviews: 3, ratingSum: 13 },
        issueDay
      ) ?? []

    assert.equal(rating, 433n)
  })

  it("states a courier nobody has rated as a rating of zero", () => {
    const attributes = courierAttributes(
      { deliveries: 4, firstDeliveredAt: new Date("2026-11-02T01:00:00Z"), reviews: 0, ratingSum: 0 },
      issueDay
    )

    assert.deepEqual(attributes, [4n, 0n, 0n, 20_759n])
  })

  it("issues nothing to a courier with no delivery", () => {
    assert.equal(
      courierAttributes({ deliveries: 0, firstDeliveredAt: undefined, reviews: 2, ratingSum: 10 }, issueDay),
      undefined
    )
  })
})
