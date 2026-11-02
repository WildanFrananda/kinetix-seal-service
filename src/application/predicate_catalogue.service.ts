import { randomUUID } from "node:crypto"

import { hexOf } from "../domain/hex.ts"
import { issueDayOf } from "../domain/issue_day.ts"
import { maxLiveTemplatesPerClass } from "../domain/predicate_limits.ts"
import { predicateRowsOf } from "../domain/predicate_rows.ts"
import type { CallerPrincipal } from "../types/caller_principal.type.ts"
import type { PredicateApprovalOutcome } from "../types/predicate_approval_outcome.type.ts"
import type { PredicateCatalogueDependencies } from "../types/predicate_catalogue_dependencies.type.ts"
import type { PredicateDraft } from "../types/predicate_draft.type.ts"
import type { PredicateListing } from "../types/predicate_listing.type.ts"
import type { PredicateStanding } from "../types/predicate_standing.type.ts"
import type { PredicateTemplate } from "../types/predicate_template.type.ts"
import type { PredicateWithdrawalOutcome } from "../types/predicate_withdrawal_outcome.type.ts"
import type { RegistryGeneration } from "../types/registry_generation.type.ts"

class PredicateCatalogue {
  private readonly dependencies: PredicateCatalogueDependencies

  constructor(dependencies: PredicateCatalogueDependencies) {
    this.dependencies = dependencies
  }

  async approve(caller: CallerPrincipal, draft: PredicateDraft, at: Date): Promise<PredicateApprovalOutcome> {
    if (caller.role !== "admin") {
      return { kind: "not_admin" }
    }

    const template: PredicateTemplate = {
      id: randomUUID(),
      ...draft,
      approvedBy: caller.principalId,
      approvedAt: at,
      withdrawnBy: undefined,
      withdrawnAt: undefined
    }

    const stored = await this.dependencies.templates.approve(template, maxLiveTemplatesPerClass)

    if (stored !== "approved") {
      return { kind: stored }
    }

    this.dependencies.logger.info({
      message: "a predicate was approved",
      fields: { predicate_template_id: template.id, approved_by: caller.principalId }
    })

    return { kind: "approved", standing: await this.standingOf(template, at) }
  }

  async withdraw(caller: CallerPrincipal, id: string, at: Date): Promise<PredicateWithdrawalOutcome> {
    if (caller.role !== "admin") {
      return "not_admin"
    }

    const outcome = await this.dependencies.templates.withdraw(id, caller.principalId, at)

    if (outcome === "withdrawn") {
      this.dependencies.logger.info({
        message: "a predicate was withdrawn",
        fields: { predicate_template_id: id, withdrawn_by: caller.principalId }
      })
    }

    return outcome
  }

  async listing(at: Date): Promise<PredicateListing> {
    const active = await this.activeGeneration()
    const placed = await this.placedIds(active)
    const templates = await this.dependencies.templates.live()

    return {
      registry:
        active === undefined ? undefined : { generation: active.generation, contractAddress: active.contractAddress },
      standings: templates.map((template) => this.standingWith(template, at, placed))
    }
  }

  async standing(id: string, at: Date): Promise<PredicateStanding | undefined> {
    const template = await this.dependencies.templates.byId(id)

    if (template === undefined) {
      return undefined
    }

    return this.standingOf(template, at)
  }

  private async standingOf(template: PredicateTemplate, at: Date): Promise<PredicateStanding> {
    return this.standingWith(template, at, await this.placedIds(await this.activeGeneration()))
  }

  private standingWith(template: PredicateTemplate, at: Date, placed: ReadonlySet<string>): PredicateStanding {
    if (template.withdrawnAt !== undefined) {
      return { template, rows: [] }
    }

    const { chain, periodDays } = this.dependencies
    const rows = predicateRowsOf(template, issueDayOf(at), periodDays).map((row) => {
      const id = chain.predicateIdOf(row.predicate)

      return {
        id,
        predicate: row.predicate,
        minimumIssueDay: row.minimumIssueDay,
        current: row.current,
        placed: placed.has(hexOf(id))
      }
    })

    return { template, rows }
  }

  private async activeGeneration(): Promise<RegistryGeneration | undefined> {
    const unretired = await this.dependencies.generations.unretired()

    return unretired.find((generation) => generation.status === "active")
  }

  private async placedIds(active: RegistryGeneration | undefined): Promise<Set<string>> {
    if (active === undefined) {
      return new Set()
    }

    const placements = await this.dependencies.placements.ofGeneration(active.generation)

    return new Set(placements.map((placement) => hexOf(placement.id)))
  }
}

export default PredicateCatalogue
