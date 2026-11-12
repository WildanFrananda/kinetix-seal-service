import type { ReportRightStorePort } from "../../src/application/ports/report_right_store.port.ts"
import type { HeldRight } from "../../src/types/held_right.type.ts"
import type { ReportRight } from "../../src/types/report_right.type.ts"
import type { RightCandidate } from "../../src/types/right_candidate.type.ts"
import type { RightGrantStatus } from "../../src/types/right_grant_status.type.ts"
import type { UnsettledGrant } from "../../src/types/unsettled_grant.type.ts"

type Grant = { rightId: string; generation: number; status: RightGrantStatus; leafIndex: bigint | undefined }

class FakeReportRightStore implements ReportRightStorePort {
  readonly pending: RightCandidate[] = []
  readonly rights: ReportRight[] = []
  readonly grants: Grant[] = []
  readonly held = new Map<string, HeldRight[]>()

  async candidates(limit: number): Promise<RightCandidate[]> {
    return this.pending
      .filter((candidate) => !this.rights.some((right) => right.orderNumber === candidate.orderNumber))
      .slice(0, limit)
  }

  async insert(rights: ReportRight[]): Promise<number> {
    this.rights.push(...rights)

    return rights.length
  }

  async queueAll(generation: number): Promise<number> {
    let queued = 0

    for (const right of this.rights) {
      if (!this.grants.some((grant) => grant.rightId === right.id && grant.generation === generation)) {
        this.grants.push({ rightId: right.id, generation, status: "pending", leafIndex: undefined })
        queued += 1
      }
    }

    return queued
  }

  async nextUnsettled(generation: number): Promise<UnsettledGrant | undefined> {
    const grant = this.grants.find((row) => row.generation === generation && row.status !== "granted")
    const right = this.rights.find((row) => row.id === grant?.rightId)

    if (grant === undefined || right === undefined || grant.status === "granted") {
      return undefined
    }

    return { right, status: grant.status }
  }

  async markUncertain(rightId: string, generation: number): Promise<void> {
    this.grantOf(rightId, generation).status = "uncertain"
  }

  async markGranted(rightId: string, generation: number, leafIndex: bigint): Promise<void> {
    const grant = this.grantOf(rightId, generation)

    grant.status = "granted"
    grant.leafIndex = leafIndex
  }

  async heldBy(principalId: string, generation: number | undefined): Promise<HeldRight[]> {
    const held = this.held.get(principalId) ?? []

    return generation === undefined ? held.map((right) => ({ ...right, leafIndex: undefined, crowd: 0 })) : held
  }

  statusOf(rightId: string, generation: number): RightGrantStatus | undefined {
    return this.grants.find((grant) => grant.rightId === rightId && grant.generation === generation)?.status
  }

  private grantOf(rightId: string, generation: number): Grant {
    const grant = this.grants.find((row) => row.rightId === rightId && row.generation === generation)

    if (grant === undefined) {
      throw new Error(`right ${rightId} is not queued in generation ${generation}`)
    }

    return grant
  }
}

export default FakeReportRightStore
