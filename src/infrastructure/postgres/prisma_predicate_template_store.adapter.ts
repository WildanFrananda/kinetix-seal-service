import type { PredicateTemplateStorePort } from "../../application/ports/predicate_template_store.port.ts"
import { bytesOf, hexOf } from "../../domain/hex.ts"
import type { PredicateTemplate } from "../../types/predicate_template.type.ts"
import type { PredicateTemplateApproval } from "../../types/predicate_template_approval.type.ts"
import type { PredicateTemplateWithdrawal } from "../../types/predicate_template_withdrawal.type.ts"
import type { Prisma, PrismaClient } from "./generated/client.ts"

type TemplateRow = Prisma.PredicateTemplateGetPayload<Record<string, never>>

function templateOf(row: TemplateRow): PredicateTemplate {
  return {
    id: row.id,
    classId: bytesOf(row.classId),
    label: row.label,
    minimums: row.minimums,
    freshnessDays: row.freshnessDays,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    withdrawnBy: row.withdrawnBy ?? undefined,
    withdrawnAt: row.withdrawnAt ?? undefined
  }
}

function sameMinimums(row: TemplateRow, template: PredicateTemplate): boolean {
  if (row.freshnessDays !== template.freshnessDays || row.minimums.length !== template.minimums.length) {
    return false
  }

  return row.minimums.every((minimum, index) => minimum === template.minimums[index])
}

class PrismaPredicateTemplateStore implements PredicateTemplateStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async approve(template: PredicateTemplate, liveLimit: number): Promise<PredicateTemplateApproval> {
    const classId = hexOf(template.classId)

    return this.prisma.$transaction(async (transaction): Promise<PredicateTemplateApproval> => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('kinetix_seal_predicate_templates'))::text AS "locked"`

      const live = await transaction.predicateTemplate.findMany({ where: { classId, withdrawnAt: null } })

      if (live.some((row) => sameMinimums(row, template))) {
        return "duplicate"
      }

      if (live.length >= liveLimit) {
        return "full"
      }

      await transaction.predicateTemplate.create({
        data: {
          id: template.id,
          classId,
          label: template.label,
          minimums: template.minimums,
          freshnessDays: template.freshnessDays,
          approvedBy: template.approvedBy,
          approvedAt: template.approvedAt
        }
      })

      return "approved"
    })
  }

  async withdraw(id: string, by: string, at: Date): Promise<PredicateTemplateWithdrawal> {
    const changed = await this.prisma.predicateTemplate.updateMany({
      where: { id, withdrawnAt: null },
      data: { withdrawnBy: by, withdrawnAt: at }
    })

    if (changed.count > 0) {
      return "withdrawn"
    }

    const existing = await this.prisma.predicateTemplate.findUnique({ where: { id }, select: { id: true } })

    return existing === null ? "absent" : "already_withdrawn"
  }

  async live(): Promise<PredicateTemplate[]> {
    const rows = await this.prisma.predicateTemplate.findMany({
      where: { withdrawnAt: null },
      orderBy: [{ approvedAt: "asc" }, { id: "asc" }]
    })

    return rows.map(templateOf)
  }

  async byId(id: string): Promise<PredicateTemplate | undefined> {
    const row = await this.prisma.predicateTemplate.findUnique({ where: { id } })

    return row === null ? undefined : templateOf(row)
  }
}

export default PrismaPredicateTemplateStore
