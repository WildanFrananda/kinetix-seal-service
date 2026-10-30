import { createHash } from "node:crypto"
import { type SigningKey, signingKeyFromBip340 } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime"

function maintenanceSigningKey(issuerSecret: Uint8Array, generation: number): SigningKey {
  const index = Buffer.alloc(4)

  index.writeUInt32BE(generation)

  return signingKeyFromBip340(
    createHash("sha256").update("kinetix:seal:maintenance").update(issuerSecret).update(index).digest()
  )
}

export { maintenanceSigningKey }
