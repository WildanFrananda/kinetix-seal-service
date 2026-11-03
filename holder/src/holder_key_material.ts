import {
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  ZKConfigProvider,
  type ZKIR
} from "@midnight-ntwrk/midnight-js-types"
import type { KeyMaterialProvider, ProvingKeyMaterial } from "@midnight-ntwrk/zkir-v2"

import type { PresentKeyMaterial } from "../types/present_key_material.type.ts"

function assertPresent(circuitId: string): void {
  if (circuitId !== "present") {
    throw new Error(`the holder carries keys for present only, not ${circuitId}`)
  }
}

class HolderKeyMaterial extends ZKConfigProvider<"present"> implements KeyMaterialProvider {
  private readonly material: PresentKeyMaterial

  constructor(material: PresentKeyMaterial) {
    super()
    this.material = material
  }

  async getZKIR(circuitId: "present"): Promise<ZKIR> {
    assertPresent(circuitId)

    return createZKIR(this.material.ir)
  }

  async getProverKey(circuitId: "present"): Promise<ProverKey> {
    assertPresent(circuitId)

    return createProverKey(this.material.proverKey)
  }

  async getVerifierKey(circuitId: "present"): Promise<VerifierKey> {
    assertPresent(circuitId)

    return createVerifierKey(this.material.verifierKey)
  }

  async lookupKey(keyLocation: string): Promise<ProvingKeyMaterial | undefined> {
    if (keyLocation !== "present") {
      return undefined
    }

    return { proverKey: this.material.proverKey, verifierKey: this.material.verifierKey, ir: this.material.ir }
  }

  async getParams(k: number): Promise<Uint8Array> {
    return this.material.params(k)
  }
}

export default HolderKeyMaterial
