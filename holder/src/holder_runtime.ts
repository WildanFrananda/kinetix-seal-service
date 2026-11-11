import { parseZkArtifactRuntimeVersion } from "@midnight-ntwrk/midnight-js-utils"
import { Zkir } from "@midnightntwrk/zkir-v3"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { AssetFetcher } from "../types/asset_fetcher.type.ts"
import { bytesOf, hexOf } from "./hex.ts"
import HolderKeyMaterial from "./holder_key_material.ts"
import { presentationOf } from "./holder_request.ts"
import { presentCredential } from "./present_credential.ts"

const secretPattern = /^[0-9a-f]{64}$/

class HolderRuntime {
  private readonly fetchAsset: AssetFetcher
  private keyMaterial: Promise<HolderKeyMaterial> | undefined

  constructor(fetchAsset: AssetFetcher) {
    this.fetchAsset = fetchAsset
  }

  prepare(): Promise<HolderKeyMaterial> {
    if (this.keyMaterial === undefined) {
      this.keyMaterial = this.load().catch((error: unknown) => {
        this.keyMaterial = undefined

        throw error
      })
    }

    return this.keyMaterial
  }

  holderPublicKey(secret: string): string {
    if (!secretPattern.test(secret)) {
      throw new Error("the holder secret must be 32 bytes in lowercase hex")
    }

    return pureCircuits.holderPublicKey(bytesOf(secret)).toString()
  }

  async present(request: unknown): Promise<string> {
    const presentation = presentationOf(request)

    return hexOf(await presentCredential(presentation, await this.prepare()))
  }

  private async load(): Promise<HolderKeyMaterial> {
    const [proverKey, verifierKey, ir, manifest] = await Promise.all([
      this.fetchAsset("present.prover"),
      this.fetchAsset("present.verifier"),
      this.fetchAsset("present.bzkir"),
      this.fetchAsset("contract-manifest.json")
    ])

    const k = Zkir.deserialize(ir).getK()
    const params = await this.fetchAsset(`bls_midnight_2p${k}`)

    return new HolderKeyMaterial({
      proverKey,
      verifierKey,
      ir,
      runtimeVersion: parseZkArtifactRuntimeVersion(new TextDecoder().decode(manifest)),
      params: async function paramsOf(asked: number): Promise<Uint8Array> {
        if (asked !== k) {
          throw new Error(`the holder carries the parameters for k=${k}, not k=${asked}`)
        }

        return params
      }
    })
  }
}

export default HolderRuntime
