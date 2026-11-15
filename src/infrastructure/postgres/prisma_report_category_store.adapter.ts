import type { ReportCategoryStorePort } from "../../application/ports/report_category_store.port.ts"
import type { ReportCategory } from "../../types/report_category.type.ts"
import type { PrismaClient } from "./generated/client.ts"

class PrismaReportCategoryStore implements ReportCategoryStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async listActive(): Promise<ReportCategory[]> {
    const rows = await this.prisma.reportCategory.findMany({
      where: { active: true },
      orderBy: { slug: "asc" }
    })

    return rows.map((row) => ({ slug: row.slug, label: row.label, active: row.active }))
  }

  async findActive(slug: string): Promise<ReportCategory | undefined> {
    const row = await this.prisma.reportCategory.findFirst({ where: { slug, active: true } })

    if (row === null) {
      return undefined
    }

    return { slug: row.slug, label: row.label, active: row.active }
  }
}

export default PrismaReportCategoryStore
