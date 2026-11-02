const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isLowercaseUuid(text: string): boolean {
  return uuid.test(text)
}

export { isLowercaseUuid }
