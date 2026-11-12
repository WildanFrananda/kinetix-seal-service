import { parseHolderPublicKey } from "./holder_public_key.ts"

function parseReporterKey(text: string): bigint | undefined {
  return parseHolderPublicKey(text)
}

export { parseReporterKey }
