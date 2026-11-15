type ReportStatusView = {
  nullifier: string
  status: "submitted" | "confirmed"
  generation: number
  txId: string | undefined
  submittedAt: Date
  confirmedAt: Date | undefined
}

export type { ReportStatusView }
