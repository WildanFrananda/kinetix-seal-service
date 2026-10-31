function serviceOfCertificate(subjectAltName: string | undefined, trustDomains: readonly string[]): string | undefined {
  const services = new Set<string>()

  for (const entry of (subjectAltName ?? "").split(",")) {
    const value = entry.trim()

    if (!value.startsWith("URI:spiffe://")) {
      continue
    }

    const id = value.slice("URI:".length)

    for (const domain of trustDomains) {
      const prefix = `spiffe://${domain}/service/`

      if (id.startsWith(prefix) && /^[a-z0-9-]+$/.test(id.slice(prefix.length))) {
        services.add(id.slice(prefix.length))
      }
    }
  }

  return services.size === 1 ? [...services][0] : undefined
}

export { serviceOfCertificate }
