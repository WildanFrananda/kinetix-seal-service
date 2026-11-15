import type { FiledReportStorePort } from "../../application/ports/filed_report_store.port.ts"
import type { FiledReportRecord } from "../../types/filed_report_record.type.ts"
import type { UnsettledReportSeed } from "../../types/unsettled_report_seed.type.ts"
import type { FiledReport, PrismaClient } from "./generated/client.ts"

function recordOf(row: FiledReport): FiledReportRecord {
  return {
    nullifier: row.nullifier,
    categorySlug: row.categorySlug,
    body: row.body,
    salt: row.salt,
    digest: row.digest,
    merchantTag: row.merchantTag,
    window: row.window,
    status: row.status === "confirmed" ? "confirmed" : "submitted",
    firstGeneration: row.firstGeneration,
    txId: row.txId ?? undefined,
    submittedAt: row.submittedAt,
    confirmedAt: row.confirmedAt ?? undefined
  }
}

class PrismaFiledReportStore implements FiledReportStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async grantedHoldersCount(generation: number, merchantTag: string, window: bigint): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ holders: bigint }[]>`
      SELECT COUNT(DISTINCT rr.principal_id) AS holders
      FROM report_right_grants AS rg
      INNER JOIN report_rights AS rr ON rr.id = rg.right_id
      WHERE rg.generation = ${generation}
        AND rg.status = 'granted'
        AND rr.merchant_tag = ${merchantTag}
        AND rr."window" = ${Number(window)}
    `

    return Number(rows[0]?.holders ?? 0n)
  }

  async findByNullifier(nullifier: string): Promise<FiledReportRecord | undefined> {
    const row = await this.prisma.filedReport.findUnique({ where: { nullifier } })

    if (row === null) {
      return undefined
    }

    return recordOf(row)
  }

  async insertSubmitted(report: FiledReportRecord): Promise<boolean> {
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO filed_reports (
        nullifier,
        category_slug,
        body,
        salt,
        digest,
        merchant_tag,
        "window",
        status,
        first_generation,
        tx_id,
        submitted_at
      )
      VALUES (
        ${report.nullifier},
        ${report.categorySlug},
        ${report.body},
        ${report.salt},
        ${report.digest},
        ${report.merchantTag},
        ${report.window},
        'submitted',
        ${report.firstGeneration},
        ${report.txId ?? null},
        ${report.submittedAt}
      )
      ON CONFLICT (nullifier) DO NOTHING
    `

    return inserted === 1
  }

  async unconfirmedSubmitted(limit: number): Promise<FiledReportRecord[]> {
    const rows = await this.prisma.filedReport.findMany({
      where: { status: "submitted" },
      orderBy: { submittedAt: "asc" },
      take: limit
    })

    return rows.map(recordOf)
  }

  async markConfirmed(nullifier: string, confirmedAt: Date): Promise<void> {
    await this.prisma.filedReport.update({
      where: { nullifier },
      data: { status: "confirmed", confirmedAt }
    })
  }

  async queueMissingSeeds(generation: number, at: Date): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO report_seeds (nullifier, generation, status, attempts, queued_at)
      SELECT fr.nullifier, ${generation}, 'pending', 0, ${at}
      FROM filed_reports AS fr
      WHERE fr.status = 'confirmed'
        AND fr.first_generation <> ${generation}
      ON CONFLICT (nullifier, generation) DO NOTHING
    `
  }

  async nextUnsettledSeed(generation: number): Promise<UnsettledReportSeed | undefined> {
    const uncertain = await this.prisma.reportSeed.findFirst({
      where: { generation, status: "uncertain" },
      orderBy: { queuedAt: "asc" },
      include: { report: true }
    })

    const target =
      uncertain ??
      (await this.prisma.reportSeed.findFirst({
        where: { generation, status: "pending" },
        orderBy: { queuedAt: "asc" },
        include: { report: true }
      }))

    if (target === null) {
      return undefined
    }

    return {
      nullifier: target.nullifier,
      generation: target.generation,
      status: target.status === "uncertain" ? "uncertain" : "pending",
      attempts: target.attempts,
      merchantTag: target.report.merchantTag,
      window: target.report.window,
      digest: target.report.digest
    }
  }

  async markSeedUncertain(nullifier: string, generation: number, at: Date): Promise<void> {
    await this.prisma.reportSeed.update({
      where: { nullifier_generation: { nullifier, generation } },
      data: {
        status: "uncertain",
        attempts: { increment: 1 },
        submittedAt: at
      }
    })
  }

  async markSeeded(nullifier: string, generation: number, txId: string | undefined, at: Date): Promise<void> {
    await this.prisma.reportSeed.update({
      where: { nullifier_generation: { nullifier, generation } },
      data: {
        status: "seeded",
        txId: txId ?? null,
        seededAt: at
      }
    })
  }
}

export default PrismaFiledReportStore
