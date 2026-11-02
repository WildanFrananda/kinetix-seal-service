function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

function bytesOf(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"))
}

export { bytesOf, hexOf }
