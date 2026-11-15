type FiledReportRecord = {
  nullifier: string
  categorySlug: string
  body: string
  salt: string
  digest: string
  merchantTag: string
  window: bigint
  status: "submitted" | "confirmed"
  firstGeneration: number
  txId: string | undefined
  submittedAt: Date
  confirmedAt: Date | undefined
}

export type { FiledReportRecord }
