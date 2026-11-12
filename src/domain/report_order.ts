const orderBytes = 32

function reportOrderOf(orderNumber: string): Uint8Array {
  const encoded = new TextEncoder().encode(orderNumber)

  if (encoded.length === 0 || encoded.length > orderBytes) {
    throw new Error(`order number ${JSON.stringify(orderNumber)} does not fit in ${orderBytes} bytes`)
  }

  const padded = new Uint8Array(orderBytes)

  padded.set(encoded)

  return padded
}

export { reportOrderOf }
