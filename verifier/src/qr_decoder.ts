import jsQRModule from "jsqr"

import type { QrDecoder } from "../types/qr_decoder.type.ts"

function isDecoder(value: unknown): value is QrDecoder {
  return typeof value === "function"
}

function qrDecoderOf(candidate: unknown): QrDecoder {
  if (isDecoder(candidate)) {
    return candidate
  }

  const inner: unknown =
    typeof candidate === "object" && candidate !== null ? Reflect.get(candidate, "default") : undefined

  if (isDecoder(inner)) {
    return inner
  }

  throw new Error("jsqr exports no decoder")
}

const decodeQr = qrDecoderOf(jsQRModule)

export { decodeQr }
