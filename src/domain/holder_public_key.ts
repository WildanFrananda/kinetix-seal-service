import { MAX_FIELD } from "@midnight-ntwrk/compact-runtime"

const decimal = /^(0|[1-9][0-9]{0,77})$/

function parseHolderPublicKey(text: string): bigint | undefined {
  if (!decimal.test(text)) {
    return undefined
  }

  const value = BigInt(text)

  return value <= MAX_FIELD ? value : undefined
}

export { parseHolderPublicKey }
