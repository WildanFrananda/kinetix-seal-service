import type { ReportCategory } from "../../types/report_category.type.ts"

interface ReportCategoryStorePort {
  listActive(): Promise<ReportCategory[]>
  findActive(slug: string): Promise<ReportCategory | undefined>
}

export type { ReportCategoryStorePort }
