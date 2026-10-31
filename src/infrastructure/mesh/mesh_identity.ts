import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { MeshConfig } from "../../types/mesh_config.type.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"

function readPkiFile(directory: string, name: string): Buffer {
  try {
    return readFileSync(join(directory, name))
  } catch (error) {
    throw new Error(
      `${name} is missing from ${directory}: seal's mesh leaf is mounted there, issued with kinetix pki issue seal`,
      { cause: error }
    )
  }
}

function loadMeshIdentity(config: MeshConfig): MeshIdentity {
  return {
    certificate: readPkiFile(config.pkiDirectory, "tls.crt"),
    privateKey: readPkiFile(config.pkiDirectory, "tls.key"),
    authority: readPkiFile(config.pkiDirectory, "ca.pem"),
    trustDomains: config.trustDomains
  }
}

export { loadMeshIdentity }
