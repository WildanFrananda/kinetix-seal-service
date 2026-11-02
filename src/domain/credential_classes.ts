function classLabel(text: string): Uint8Array {
  const bytes = new Uint8Array(32)

  bytes.set(new TextEncoder().encode(text))

  return bytes
}

const courierClassId = classLabel("kinetix:seal:courier:v1")

export { courierClassId }
