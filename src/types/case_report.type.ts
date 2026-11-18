type CaseReport = {
  nullifier: string
  category: {
    slug: string
    label: string
  }
  body: string
  window: number
  status: "submitted" | "confirmed"
  firstGeneration: number
  txId: string | undefined
  submittedAt: Date
  confirmedAt: Date | undefined
}

export type { CaseReport }
