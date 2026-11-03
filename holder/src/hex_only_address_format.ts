function refuseBech32(): never {
  throw new Error("the holder passes keys in hex; bech32 is not part of this bundle")
}

const MidnightBech32m = { parse: refuseBech32 }
const ShieldedCoinPublicKey = { codec: { decode: refuseBech32 } }
const ShieldedEncryptionPublicKey = { codec: { decode: refuseBech32 } }

export { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey }
