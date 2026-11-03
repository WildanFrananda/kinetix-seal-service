import type { RequestStorage } from "../../verifier/types/request_storage.type.ts"

class FakeRequestStorage implements RequestStorage {
  readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

export default FakeRequestStorage
