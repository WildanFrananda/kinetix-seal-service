type PredicateTemplate = {
  id: string
  classId: Uint8Array
  label: string
  minimums: bigint[]
  freshnessDays: number
  approvedBy: string
  approvedAt: Date
  withdrawnBy: string | undefined
  withdrawnAt: Date | undefined
}

export type { PredicateTemplate }
