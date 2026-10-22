import type { RedactedSecret } from "../../types/redacted_secret.type.ts"
import type { SealConfig } from "../../types/seal_config.type.ts"

function sponsorSecrets(config: SealConfig): RedactedSecret[] {
  return [
    { value: config.blockfrostProjectId, placeholder: "<project_id>" },
    { value: config.sponsorMnemonic, placeholder: "<mnemonic>" }
  ]
}

export { sponsorSecrets }
