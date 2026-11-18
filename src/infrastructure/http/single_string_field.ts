function singleStringField(body: unknown, name: string): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined
  }

  const keys = Object.keys(body)

  if (keys.length !== 1 || keys[0] !== name) {
    return undefined
  }

  const value: unknown = Reflect.get(body, name)

  return typeof value === "string" ? value : undefined
}

export { singleStringField }
