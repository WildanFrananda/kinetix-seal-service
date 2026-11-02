import type { PredicateTemplateStorePort } from "../../src/application/ports/predicate_template_store.port.ts"
import type { PredicateTemplate } from "../../src/types/predicate_template.type.ts"
import type { PredicateTemplateApproval } from "../../src/types/predicate_template_approval.type.ts"
import type { PredicateTemplateWithdrawal } from "../../src/types/predicate_template_withdrawal.type.ts"

class FakePredicateTemplateStore implements PredicateTemplateStorePort {
  readonly templates: PredicateTemplate[] = []

  async approve(template: PredicateTemplate, liveLimit: number): Promise<PredicateTemplateApproval> {
    const live = this.templates.filter((candidate) => candidate.withdrawnAt === undefined)
    const same = live.some(
      (candidate) =>
        candidate.freshnessDays === template.freshnessDays && candidate.minimums.join() === template.minimums.join()
    )

    if (same) {
      return "duplicate"
    }

    if (live.length >= liveLimit) {
      return "full"
    }

    this.templates.push({ ...template })

    return "approved"
  }

  async withdraw(id: string, by: string, at: Date): Promise<PredicateTemplateWithdrawal> {
    const template = this.templates.find((candidate) => candidate.id === id)

    if (template === undefined) {
      return "absent"
    }

    if (template.withdrawnAt !== undefined) {
      return "already_withdrawn"
    }

    template.withdrawnBy = by
    template.withdrawnAt = at

    return "withdrawn"
  }

  async live(): Promise<PredicateTemplate[]> {
    return this.templates.filter((template) => template.withdrawnAt === undefined)
  }

  async byId(id: string): Promise<PredicateTemplate | undefined> {
    return this.templates.find((template) => template.id === id)
  }
}

export default FakePredicateTemplateStore
