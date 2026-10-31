class SettingReader {
  private readonly env: NodeJS.ProcessEnv
  private readonly missing: string[] = []
  private readonly invalid: string[] = []

  constructor(env: NodeJS.ProcessEnv) {
    this.env = env
  }

  text(name: string): string {
    const value = this.env[name]?.trim()

    if (value === undefined || value === "") {
      this.missing.push(name)

      return ""
    }

    return value
  }

  positiveInteger(name: string): number {
    const value = this.text(name)

    if (value === "") {
      return 0
    }

    const parsed = /^[0-9]+$/.test(value) ? Number(value) : Number.NaN

    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      this.invalid.push(`${name} must be a positive integer`)
    }

    return parsed
  }

  oneOf<T extends string>(name: string, allowed: readonly T[]): T {
    const value = this.text(name)
    const match = allowed.find((candidate) => candidate === value)

    if (value !== "" && match === undefined) {
      this.invalid.push(`${name} must be one of ${allowed.join(", ")}`)
    }

    return match ?? (value as T)
  }

  url(name: string, protocols: readonly string[]): string {
    const value = this.text(name)

    if (value === "") {
      return value
    }

    if (!URL.canParse(value) || !protocols.includes(new URL(value).protocol)) {
      this.invalid.push(`${name} must be a ${protocols.join(" or ")} URL`)
    }

    return value
  }

  positiveIntegerAtMost(name: string, maximum: number): number {
    const value = this.positiveInteger(name)

    if (value > maximum) {
      this.invalid.push(`${name} must be at most ${maximum}`)
    }

    return value
  }

  address(name: string): string {
    const value = this.text(name)

    if (value !== "" && !/^[a-z0-9.-]+:[0-9]{1,5}$/.test(value)) {
      this.invalid.push(`${name} must be host:port`)
    }

    return value
  }

  list(name: string): string[] {
    const value = this.text(name)
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "")

    if (value !== "" && items.length === 0) {
      this.invalid.push(`${name} must name at least one value`)
    }

    return items
  }

  hexBytes(name: string, length: number): Uint8Array {
    const value = this.text(name)

    if (value === "") {
      return new Uint8Array(length)
    }

    if (!new RegExp(`^[0-9a-f]{${length * 2}}$`).test(value)) {
      this.invalid.push(`${name} must be ${length} bytes of lowercase hex`)

      return new Uint8Array(length)
    }

    return Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
  }

  verify(): void {
    const problems = [...this.missing.map((name) => `${name} is required and has no default`), ...this.invalid]

    if (problems.length > 0) {
      throw new Error(`the configuration is incomplete: ${problems.join("; ")}`)
    }
  }
}

export default SettingReader
