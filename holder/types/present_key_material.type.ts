type PresentKeyMaterial = {
  proverKey: Uint8Array
  verifierKey: Uint8Array
  ir: Uint8Array
  params: (k: number) => Promise<Uint8Array>
}

export type { PresentKeyMaterial }
