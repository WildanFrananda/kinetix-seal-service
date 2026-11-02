import { randomBytes, randomUUID } from "node:crypto"
import { courierAttributes } from "../domain/courier_credential_attributes.ts"
import { courierClassId } from "../domain/credential_classes.ts"
import { factsAreFresh } from "../domain/facts_are_fresh.ts"
import { issueDayOf } from "../domain/issue_day.ts"
import type { CallerPrincipal } from "../types/caller_principal.type.ts"
import type { CredentialRecord } from "../types/credential_record.type.ts"
import type { CredentialRequestOutcome } from "../types/credential_request_outcome.type.ts"
import type { CredentialStatus } from "../types/credential_status.type.ts"
import type { CourierFactReaderPort } from "./ports/courier_fact_reader.port.ts"
import type { CredentialMetricsPort } from "./ports/credential_metrics.port.ts"
import type { CredentialStorePort } from "./ports/credential_store.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"

function answerFor(earlier: CredentialRecord, holderPublicKey: bigint): CredentialRequestOutcome {
  if (earlier.holderPublicKey === holderPublicKey) {
    return { kind: "existing", credential: earlier }
  }

  return { kind: "issued_today" }
}

class CourierCredentials {
  private readonly facts: CourierFactReaderPort
  private readonly store: CredentialStorePort
  private readonly generations: RegistryGenerationStorePort
  private readonly metrics: CredentialMetricsPort
  private readonly factsMaxAgeSeconds: number

  constructor(
    facts: CourierFactReaderPort,
    store: CredentialStorePort,
    generations: RegistryGenerationStorePort,
    metrics: CredentialMetricsPort,
    factsMaxAgeSeconds: number
  ) {
    this.facts = facts
    this.store = store
    this.generations = generations
    this.metrics = metrics
    this.factsMaxAgeSeconds = factsMaxAgeSeconds
  }

  async request(caller: CallerPrincipal, holderPublicKey: bigint, at: Date): Promise<CredentialRequestOutcome> {
    const outcome = await this.decide(caller, holderPublicKey, at)

    this.metrics.requested(outcome.kind)

    return outcome
  }

  async status(caller: CallerPrincipal, id: string): Promise<CredentialStatus | undefined> {
    const credential = await this.store.byId(id)

    if (credential === undefined || credential.principalId !== caller.principalId) {
      return undefined
    }

    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return { credential, standing: "pending", placement: undefined }
    }

    const issuance = await this.store.issuanceOf(credential.id, active.generation)

    if (issuance?.status === "issued" && issuance.leafIndex !== undefined) {
      return {
        credential,
        standing: "issued",
        placement: {
          generation: active.generation,
          contractAddress: active.contractAddress,
          leafIndex: issuance.leafIndex,
          txId: issuance.txId
        }
      }
    }

    if (issuance !== undefined || (await this.store.isCurrent(credential))) {
      return { credential, standing: "pending", placement: undefined }
    }

    return { credential, standing: "superseded", placement: undefined }
  }

  private async decide(caller: CallerPrincipal, holderPublicKey: bigint, at: Date): Promise<CredentialRequestOutcome> {
    if (caller.role !== "courier") {
      return { kind: "not_a_courier" }
    }

    if (!factsAreFresh(await this.facts.catchUp(), at, this.factsMaxAgeSeconds)) {
      return { kind: "facts_stale" }
    }

    const issueDay = issueDayOf(at)
    const earlier = await this.store.forDay(caller.principalId, courierClassId, issueDay)

    if (earlier !== undefined) {
      return answerFor(earlier, holderPublicKey)
    }

    const attributes = courierAttributes(await this.facts.summaryOf(caller.principalId), issueDay)

    if (attributes === undefined) {
      return { kind: "no_deliveries" }
    }

    const credential: CredentialRecord = {
      id: randomUUID(),
      principalId: caller.principalId,
      classId: courierClassId,
      attributes,
      salt: new Uint8Array(randomBytes(32)),
      holderPublicKey,
      issueDay,
      requestedAt: at
    }

    if ((await this.store.record(credential)) === "conflict") {
      const raced = await this.store.forDay(caller.principalId, courierClassId, issueDay)

      if (raced === undefined) {
        throw new Error("a credential for this day conflicted and then could not be read")
      }

      return answerFor(raced, holderPublicKey)
    }

    return { kind: "accepted", credential }
  }
}

export default CourierCredentials
