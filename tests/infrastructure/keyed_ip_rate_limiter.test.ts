import assert from "node:assert/strict"
import { describe, it } from "node:test"

import KeyedIpRateLimiter from "../../src/infrastructure/http/keyed_ip_rate_limiter.ts"

describe("keyed IP rate limiter", () => {
  it("limits submissions per hashed IP within the window and resets once expired", () => {
    const limiter = new KeyedIpRateLimiter(2, 60, new Uint8Array(32).fill(9))
    const t0 = new Date("2026-11-14T12:00:00Z")

    assert.equal(limiter.allow("203.0.113.10", t0), true)
    assert.equal(limiter.allow("203.0.113.10", new Date("2026-11-14T12:00:30Z")), true)
    assert.equal(limiter.allow("203.0.113.10", new Date("2026-11-14T12:00:45Z")), false)
    assert.equal(limiter.allow("203.0.113.11", new Date("2026-11-14T12:00:45Z")), true)

    assert.equal(limiter.allow("203.0.113.10", new Date("2026-11-14T12:01:01Z")), true)
  })

  it("evicts expired buckets so addresses are forgotten cleanly", () => {
    const limiter = new KeyedIpRateLimiter(1, 30, new Uint8Array(32).fill(5))

    assert.equal(limiter.allow("198.51.100.1", new Date("2026-11-14T12:00:00Z")), true)
    assert.equal(limiter.size(), 1)
    assert.equal(limiter.allow("198.51.100.2", new Date("2026-11-14T12:00:31Z")), true)
    assert.equal(limiter.size(), 1)
  })
})
