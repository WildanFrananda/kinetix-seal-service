import type { CredentialStorePort } from "../../src/application/ports/credential_store.port.ts"
import type { CredentialRecord } from "../../src/types/credential_record.type.ts"
import type { IssuanceRecord } from "../../src/types/issuance_record.type.ts"
import type { UnsettledIssuance } from "../../src/types/unsettled_issuance.type.ts"

function sameClass(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right))
}

function newestFirst(left: CredentialRecord, right: CredentialRecord): number {
  const byTime = right.requestedAt.getTime() - left.requestedAt.getTime()

  return byTime !== 0 ? byTime : right.id.localeCompare(left.id)
}

class FakeCredentialStore implements CredentialStorePort {
  readonly credentials: CredentialRecord[] = []
  readonly issuances: IssuanceRecord[] = []
  conflictOnce: CredentialRecord | undefined

  async forDay(principalId: string, classId: Uint8Array, issueDay: number): Promise<CredentialRecord | undefined> {
    return this.credentials.find((credential) => {
      return (
        credential.principalId === principalId &&
        sameClass(credential.classId, classId) &&
        credential.issueDay === issueDay
      )
    })
  }

  async record(credential: CredentialRecord): Promise<"recorded" | "conflict"> {
    const raced = this.conflictOnce

    if (raced !== undefined) {
      this.conflictOnce = undefined
      this.credentials.push(raced)

      return "conflict"
    }

    if ((await this.forDay(credential.principalId, credential.classId, credential.issueDay)) !== undefined) {
      return "conflict"
    }

    this.credentials.push(credential)

    return "recorded"
  }

  async byId(id: string): Promise<CredentialRecord | undefined> {
    return this.credentials.find((credential) => credential.id === id)
  }

  async isCurrent(credential: CredentialRecord): Promise<boolean> {
    return this.currentOf(credential.principalId, credential.classId)?.id === credential.id
  }

  async issuanceOf(credentialId: string, generation: number): Promise<IssuanceRecord | undefined> {
    return this.issuances.find((row) => row.credentialId === credentialId && row.generation === generation)
  }

  async queueCurrent(generation: number): Promise<number> {
    let queued = 0

    for (const credential of this.credentials) {
      const current = this.currentOf(credential.principalId, credential.classId)

      if (current?.id !== credential.id || (await this.issuanceOf(credential.id, generation)) !== undefined) {
        continue
      }

      this.issuances.push({
        credentialId: credential.id,
        generation,
        status: "pending",
        leaf: undefined,
        leafIndex: undefined,
        txId: undefined
      })
      queued += 1
    }

    return queued
  }

  async nextUnsettled(generation: number): Promise<UnsettledIssuance | undefined> {
    const issuance = this.issuances.find((row) => row.generation === generation && row.status !== "issued")
    const credential = issuance === undefined ? undefined : await this.byId(issuance.credentialId)

    return issuance === undefined || credential === undefined ? undefined : { issuance: { ...issuance }, credential }
  }

  async markUncertain(credentialId: string, generation: number, leaf: Uint8Array): Promise<void> {
    const row = this.rowOf(credentialId, generation)

    row.status = "uncertain"
    row.leaf = leaf
  }

  async markIssued(
    credentialId: string,
    generation: number,
    leafIndex: bigint,
    txId: string | undefined
  ): Promise<void> {
    const row = this.rowOf(credentialId, generation)

    row.status = "issued"
    row.leafIndex = leafIndex
    row.txId = txId ?? row.txId
  }

  private currentOf(principalId: string, classId: Uint8Array): CredentialRecord | undefined {
    return this.credentials
      .filter((candidate) => candidate.principalId === principalId && sameClass(candidate.classId, classId))
      .sort(newestFirst)[0]
  }

  private rowOf(credentialId: string, generation: number): IssuanceRecord {
    const row = this.issuances.find((candidate) => {
      return candidate.credentialId === credentialId && candidate.generation === generation
    })

    if (row === undefined) {
      throw new Error(`no issuance of ${credentialId} in generation ${generation}`)
    }

    return row
  }
}

export default FakeCredentialStore
