import { createHash, createHmac } from "node:crypto"

function merchantTagOf(issuerSecret: Uint8Array, merchantPrincipalId: string): Uint8Array {
  const key = createHash("sha256").update("kinetix:seal:report:merchant-tag").update(issuerSecret).digest()

  return new Uint8Array(createHmac("sha256", key).update(merchantPrincipalId).digest())
}

export { merchantTagOf }
