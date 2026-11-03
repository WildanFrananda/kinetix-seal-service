import type { HolderPresentation } from "../types/holder_presentation.type.ts"
import { bytesOf } from "./hex.ts"
import { decodeRegistrySnapshot } from "./registry_snapshot.ts"

const field32 = /^[0-9a-f]{64}$/
const decimal = /^(0|[1-9][0-9]{0,19})$/

function objectOf(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} must be an object`)
  }

  return Object.fromEntries(Object.entries(value))
}

function bytes32Of(value: unknown, what: string): Uint8Array {
  if (typeof value !== "string" || !field32.test(value)) {
    throw new Error(`${what} must be 32 bytes in lowercase hex`)
  }

  return bytesOf(value)
}

function decimalOf(value: unknown, what: string): bigint {
  if (typeof value !== "string" || !decimal.test(value)) {
    throw new Error(`${what} must be a decimal string`)
  }

  return BigInt(value)
}

function textOf(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${what} must be a string`)
  }

  return value
}

function presentationOf(request: unknown): HolderPresentation {
  const body = objectOf(request, "the request")
  const snapshot = objectOf(body.snapshot, "the snapshot")
  const credential = objectOf(body.credential, "the credential")
  const attributes = credential.attributes

  if (!Array.isArray(attributes) || attributes.length !== 4) {
    throw new Error("the credential has four attributes")
  }

  if (typeof snapshot.generation !== "number" || !Number.isSafeInteger(snapshot.generation)) {
    throw new Error("the snapshot names its generation")
  }

  return {
    snapshot: decodeRegistrySnapshot({
      generation: snapshot.generation,
      networkId: textOf(snapshot.networkId, "the network"),
      contractAddress: textOf(snapshot.contractAddress, "the registry address"),
      contractState: textOf(snapshot.contractState, "the contract state"),
      zswapChainState: textOf(snapshot.zswapChainState, "the zswap state"),
      ledgerParameters: textOf(snapshot.ledgerParameters, "the ledger parameters"),
      readAt: textOf(snapshot.readAt, "the snapshot's time")
    }),
    holder: {
      role: "holder",
      holderSecret: bytes32Of(body.holderSecret, "the holder secret"),
      credential: {
        classId: bytes32Of(credential.classId, "the class"),
        attributes: attributes.map((attribute, index) => decimalOf(attribute, `attribute ${index}`)),
        salt: bytes32Of(credential.salt, "the salt")
      },
      leafIndex: decimalOf(body.leafIndex, "the leaf index")
    },
    challenge: bytes32Of(body.challenge, "the challenge"),
    predicateId: bytes32Of(body.predicateId, "the predicate id")
  }
}

export { presentationOf }
