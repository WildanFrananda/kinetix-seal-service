import { toHex } from "@midnight-ntwrk/midnight-js-utils"

import type { RedactedSecret } from "../../types/redacted_secret.type.ts"
import type { ServiceConfig } from "../../types/service_config.type.ts"
import type { SponsorConfig } from "../../types/sponsor_config.type.ts"

function serviceSecrets(config: ServiceConfig): RedactedSecret[] {
  return [
    { value: config.blockfrostProjectId, placeholder: "<project_id>" },
    { value: toHex(config.issuerSecret), placeholder: "<issuer_secret>" }
  ]
}

function sponsorSecrets(config: SponsorConfig): RedactedSecret[] {
  return [
    { value: config.blockfrostProjectId, placeholder: "<project_id>" },
    { value: config.sponsorMnemonic, placeholder: "<mnemonic>" }
  ]
}

export { serviceSecrets, sponsorSecrets }
