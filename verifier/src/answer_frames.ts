import { hexOf } from "../../holder/src/hex.ts"
import { bytesOfBase64Url } from "./base64url.ts"

const framePattern = /^KSP1:([0-9a-f]{8}):([0-9]{1,2})\/([0-9]{1,2}):([A-Za-z0-9_-]+)$/

class AnswerFrames {
  private tag: string | undefined
  private total = 0
  private readonly chunks = new Map<number, string>()

  accept(text: string): boolean {
    const frame = framePattern.exec(text)

    if (frame === null) {
      return false
    }

    const [, tag, indexText, totalText, chunk] = frame
    const index = Number(indexText)
    const total = Number(totalText)

    if (tag === undefined || chunk === undefined || index < 1 || index > total) {
      return false
    }

    if (tag !== this.tag || total !== this.total) {
      this.tag = tag
      this.total = total
      this.chunks.clear()
    }

    this.chunks.set(index, chunk)

    return true
  }

  received(): number {
    return this.chunks.size
  }

  expected(): number {
    return this.total
  }

  async transaction(): Promise<string | undefined> {
    if (this.total === 0 || this.chunks.size !== this.total) {
      return undefined
    }

    const joined = Array.from({ length: this.total }, (_, index) => this.chunks.get(index + 1) ?? "").join("")
    const bytes = bytesOfBase64Url(joined)

    if (bytes === undefined) {
      return undefined
    }

    const digest = hexOf(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))

    return digest.startsWith(this.tag ?? "-") ? hexOf(bytes) : undefined
  }
}

export default AnswerFrames
