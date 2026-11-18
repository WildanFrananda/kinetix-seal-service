type CaseAggregateRow = {
  merchant_tag: string
  confirmed_count: bigint
  pending_count: bigint
  total_count: bigint
  window_count: bigint
  earliest_window: bigint
  latest_window: bigint
  first_reported_at: Date
  latest_reported_at: Date
}

export type { CaseAggregateRow }
