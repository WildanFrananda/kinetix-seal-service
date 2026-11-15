import { createHash } from "node:crypto"

const digestDomain = new TextEncoder().encode("kinetix:seal:report:digest:v1\0")
const nullByte = new Uint8Array([0])
const maximumBodyLength = 4000

function reportDigestOf(category: string, body: string, salt: Uint8Array): Uint8Array {
  if (salt.length !== 32) {
    throw new RangeError("salt must be 32 bytes")
  }

  const encoder = new TextEncoder()
  const hash = createHash("sha256")

  hash.update(digestDomain)
  hash.update(salt)
  hash.update(encoder.encode(category))
  hash.update(nullByte)
  hash.update(encoder.encode(body))

  return new Uint8Array(hash.digest())
}

function isReportBodyValid(body: string): boolean {
  return body.trim().length > 0 && body.length <= maximumBodyLength
}

export { isReportBodyValid, reportDigestOf }
