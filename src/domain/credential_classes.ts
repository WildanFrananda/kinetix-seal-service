import type { CredentialClass } from "../types/credential_class.type.ts"

function classLabel(text: string): Uint8Array {
  const bytes = new Uint8Array(32)

  bytes.set(new TextEncoder().encode(text))

  return bytes
}

const courierClassId = classLabel("kinetix:seal:courier:v1")

const courierClass: CredentialClass = {
  name: "courier",
  id: courierClassId,
  thresholds: [
    { name: "deliveries", maximum: 1_000_000n },
    { name: "ratingHundredths", maximum: 500n },
    { name: "daysActive", maximum: 36_525n }
  ]
}

const credentialClasses: readonly CredentialClass[] = [courierClass]

function classNamed(name: string): CredentialClass | undefined {
  return credentialClasses.find((candidate) => candidate.name === name)
}

function classWithId(id: Uint8Array): CredentialClass | undefined {
  return credentialClasses.find((candidate) => Buffer.from(candidate.id).equals(id))
}

export { classNamed, classWithId, courierClass, courierClassId }
