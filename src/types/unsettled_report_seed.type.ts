type UnsettledReportSeed = {
  nullifier: string
  generation: number
  status: "pending" | "uncertain"
  attempts: number
  merchantTag: string
  window: bigint
  digest: string
}

export type { UnsettledReportSeed }
