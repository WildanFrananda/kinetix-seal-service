function bearerTokenOf(authorization: string | undefined): string | undefined {
  const match = /^Bearer[ \t]+([A-Za-z0-9._~+/=-]+)[ \t]*$/i.exec(authorization ?? "")

  return match?.[1]
}

export { bearerTokenOf }
