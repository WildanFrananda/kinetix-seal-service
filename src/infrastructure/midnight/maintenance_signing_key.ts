import { createHash } from "node:crypto"
import { type SigningKey, signingKeyFromBip340 } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime"

import type { RegistryKind } from "../../types/registry_kind.type.ts"

const domains: Record<RegistryKind, string> = {
  credential: "kinetix:seal:maintenance",
  report: "kinetix:seal:report:maintenance"
}

function maintenanceSigningKey(issuerSecret: Uint8Array, registry: RegistryKind, generation: number): SigningKey {
  const index = Buffer.alloc(4)

  index.writeUInt32BE(generation)

  return signingKeyFromBip340(
    createHash("sha256").update(domains[registry]).update(issuerSecret).update(index).digest()
  )
}

export { maintenanceSigningKey }
