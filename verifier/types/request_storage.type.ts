type RequestStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type { RequestStorage }
