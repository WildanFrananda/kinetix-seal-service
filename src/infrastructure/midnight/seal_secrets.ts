import { toHex } from "@midnight-ntwrk/midnight-js-utils"

import type { RedactedSecret } from "../../types/redacted_secret.type.ts"
import type { SealConfig } from "../../types/seal_config.type.ts"

function sealSecrets(config: SealConfig): RedactedSecret[] {
  return [
    { value: config.blockfrostProjectId, placeholder: "<project_id>" },
    { value: config.sponsorMnemonic, placeholder: "<mnemonic>" },
    { value: toHex(config.issuerSecret), placeholder: "<issuer_secret>" }
  ]
}

export { sealSecrets }
