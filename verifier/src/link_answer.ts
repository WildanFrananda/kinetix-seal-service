import { hexOf } from "../../holder/src/hex.ts"
import type { LinkAnswer } from "../types/link_answer.type.ts"
import { bytesOfBase64Url } from "./base64url.ts"

const fragmentPattern = /^#?([0-9a-f]{64})\.([A-Za-z0-9_-]+)$/

function linkAnswerOf(fragment: string): LinkAnswer | undefined {
  const match = fragmentPattern.exec(fragment)
  const challenge = match?.[1]
  const encoded = match?.[2]
  const bytes = encoded === undefined ? undefined : bytesOfBase64Url(encoded)

  if (challenge === undefined || bytes === undefined) {
    return undefined
  }

  return { challenge, transactionHex: hexOf(bytes) }
}

export { linkAnswerOf }
