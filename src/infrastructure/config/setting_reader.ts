class SettingReader {
  readonly #env: NodeJS.ProcessEnv
  readonly #missing: string[] = []
  readonly #invalid: string[] = []

  constructor(env: NodeJS.ProcessEnv) {
    this.#env = env
  }

  text(name: string): string {
    const value = this.#env[name]?.trim()

    if (value === undefined || value === "") {
      this.#missing.push(name)

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
      this.#invalid.push(`${name} must be a positive integer`)
    }

    return parsed
  }

  oneOf<T extends string>(name: string, allowed: readonly T[]): T {
    const value = this.text(name)
    const match = allowed.find((candidate) => candidate === value)

    if (value !== "" && match === undefined) {
      this.#invalid.push(`${name} must be one of ${allowed.join(", ")}`)
    }

    return match ?? (value as T)
  }

  url(name: string, protocols: readonly string[]): string {
    const value = this.text(name)

    if (value === "") {
      return value
    }

    if (!URL.canParse(value) || !protocols.includes(new URL(value).protocol)) {
      this.#invalid.push(`${name} must be a ${protocols.join(" or ")} URL`)
    }

    return value
  }

  verify(): void {
    const problems = [...this.#missing.map((name) => `${name} is required and has no default`), ...this.#invalid]

    if (problems.length > 0) {
      throw new Error(`the configuration is incomplete: ${problems.join("; ")}`)
    }
  }
}

export default SettingReader
