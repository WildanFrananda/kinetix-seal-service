const hexPair = /^[0-9a-f]{2}$/

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function bytesOf(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("a hex string has an even length")
  }

  const bytes = new Uint8Array(hex.length / 2)

  for (let index = 0; index < bytes.length; index += 1) {
    const pair = hex.slice(index * 2, index * 2 + 2)

    if (!hexPair.test(pair)) {
      throw new Error("a hex string holds only 0-9 and a-f")
    }

    bytes[index] = Number.parseInt(pair, 16)
  }

  return bytes
}

export { bytesOf, hexOf }
