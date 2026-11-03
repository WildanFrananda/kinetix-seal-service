import type { IssuedRequest } from "../types/issued_request.type.ts"
import type { RequestStorage } from "../types/request_storage.type.ts"

const storageKey = "kinetix.seal.verifier.requests"
const lifetimeMilliseconds = 2 * 60 * 60 * 1000
const kept = 20

function isIssuedRequest(value: unknown): value is IssuedRequest {
  if (typeof value !== "object" || value === null) {
    return false
  }

  return (
    typeof Reflect.get(value, "challenge") === "string" &&
    typeof Reflect.get(value, "predicateId") === "string" &&
    typeof Reflect.get(value, "label") === "string" &&
    typeof Reflect.get(value, "issuedAt") === "number"
  )
}

class IssuedRequests {
  private readonly storage: RequestStorage

  constructor(storage: RequestStorage) {
    this.storage = storage
  }

  remember(request: IssuedRequest, now: number): void {
    const current = this.alive(now).filter((known) => known.challenge !== request.challenge)

    this.storage.setItem(storageKey, JSON.stringify([request, ...current].slice(0, kept)))
  }

  find(challenge: string, now: number): IssuedRequest | undefined {
    return this.alive(now).find((known) => known.challenge === challenge)
  }

  private alive(now: number): IssuedRequest[] {
    let stored: unknown

    try {
      stored = JSON.parse(this.storage.getItem(storageKey) ?? "[]")
    } catch {
      return []
    }

    if (!Array.isArray(stored)) {
      return []
    }

    return stored.filter(isIssuedRequest).filter((known) => now - known.issuedAt < lifetimeMilliseconds)
  }
}

export default IssuedRequests
