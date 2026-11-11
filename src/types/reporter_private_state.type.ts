type ReporterPrivateState = {
  role: "reporter"
  reporterSecret: Uint8Array
  order: Uint8Array
  leafIndex: bigint
}

export type { ReporterPrivateState }
