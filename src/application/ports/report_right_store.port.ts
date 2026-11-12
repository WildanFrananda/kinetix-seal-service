import type { HeldRight } from "../../types/held_right.type.ts"
import type { ReportRight } from "../../types/report_right.type.ts"
import type { RightCandidate } from "../../types/right_candidate.type.ts"
import type { UnsettledGrant } from "../../types/unsettled_grant.type.ts"

interface ReportRightStorePort {
  candidates(limit: number): Promise<RightCandidate[]>
  insert(rights: ReportRight[]): Promise<number>
  queueAll(generation: number, at: Date): Promise<number>
  nextUnsettled(generation: number): Promise<UnsettledGrant | undefined>
  markUncertain(rightId: string, generation: number, at: Date): Promise<void>
  markGranted(rightId: string, generation: number, leafIndex: bigint, txId: string | undefined, at: Date): Promise<void>
  heldBy(principalId: string, generation: number | undefined): Promise<HeldRight[]>
}

export type { ReportRightStorePort }
