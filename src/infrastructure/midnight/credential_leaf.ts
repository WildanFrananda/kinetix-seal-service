import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { CredentialRecord } from "../../types/credential_record.type.ts"

function credentialLeafOf(credential: CredentialRecord): Uint8Array {
  return pureCircuits.credentialLeaf(
    { classId: credential.classId, attributes: credential.attributes, salt: credential.salt },
    credential.holderPublicKey
  )
}

export { credentialLeafOf }
