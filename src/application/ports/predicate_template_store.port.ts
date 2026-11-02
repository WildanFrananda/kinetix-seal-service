import type { PredicateTemplate } from "../../types/predicate_template.type.ts"
import type { PredicateTemplateApproval } from "../../types/predicate_template_approval.type.ts"
import type { PredicateTemplateWithdrawal } from "../../types/predicate_template_withdrawal.type.ts"

interface PredicateTemplateStorePort {
  approve(template: PredicateTemplate, liveLimit: number): Promise<PredicateTemplateApproval>
  withdraw(id: string, by: string, at: Date): Promise<PredicateTemplateWithdrawal>
  live(): Promise<PredicateTemplate[]>
  byId(id: string): Promise<PredicateTemplate | undefined>
}

export type { PredicateTemplateStorePort }
