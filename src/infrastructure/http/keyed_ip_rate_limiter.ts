import { createHmac, randomBytes } from "node:crypto"

import type { RateLimitBucket } from "../../types/rate_limit_bucket.type.ts"

class KeyedIpRateLimiter {
  private readonly key: Uint8Array
  private readonly maximum: number
  private readonly windowMs: number
  private readonly buckets: Map<string, RateLimitBucket>

  constructor(maximum: number, windowSeconds: number, key: Uint8Array = randomBytes(32)) {
    this.key = Uint8Array.from(key)
    this.maximum = maximum
    this.windowMs = windowSeconds * 1000
    this.buckets = new Map<string, RateLimitBucket>()
  }

  allow(ip: string, now: Date = new Date()): boolean {
    const nowMs = now.getTime()

    this.pruneExpired(nowMs)

    const digest = this.digestOf(ip)
    const existing = this.buckets.get(digest)

    if (existing === undefined) {
      this.buckets.set(digest, { count: 1, expiresAtMs: nowMs + this.windowMs })

      return true
    }

    if (existing.count >= this.maximum) {
      return false
    }

    existing.count += 1

    return true
  }

  size(): number {
    return this.buckets.size
  }

  private digestOf(ip: string): string {
    return createHmac("sha256", this.key).update(ip).digest("hex")
  }

  private pruneExpired(nowMs: number): void {
    for (const [digest, bucket] of this.buckets) {
      if (bucket.expiresAtMs <= nowMs) {
        this.buckets.delete(digest)
      }
    }
  }
}

export default KeyedIpRateLimiter
