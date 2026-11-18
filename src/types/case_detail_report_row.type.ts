type CaseDetailReportRow = {
  nullifier: string
  category_slug: string
  category_label: string
  body: string
  window: bigint
  status: string
  first_generation: number
  tx_id: string | null
  submitted_at: Date
  confirmed_at: Date | null
}

export type { CaseDetailReportRow }
