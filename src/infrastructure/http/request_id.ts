import { randomUUID } from "node:crypto"

const acceptable = /^[A-Za-z0-9._-]{1,128}$/

function requestIdOf(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header

  return value !== undefined && acceptable.test(value) ? value : randomUUID()
}

export { requestIdOf }
