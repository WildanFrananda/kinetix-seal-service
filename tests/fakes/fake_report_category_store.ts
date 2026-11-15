import type { ReportCategoryStorePort } from "../../src/application/ports/report_category_store.port.ts"
import type { ReportCategory } from "../../src/types/report_category.type.ts"

class FakeReportCategoryStore implements ReportCategoryStorePort {
  categories: ReportCategory[]

  constructor(
    initial: ReportCategory[] = [
      { slug: "counterfeit", label: "Counterfeit product", active: true },
      { slug: "fraud", label: "Fraud or misrepresentation", active: true },
      { slug: "abuse", label: "Abusive conduct", active: true }
    ]
  ) {
    this.categories = initial.map((category) => ({ ...category }))
  }

  async listActive(): Promise<ReportCategory[]> {
    return this.categories.filter((category) => category.active).map((category) => ({ ...category }))
  }

  async findActive(slug: string): Promise<ReportCategory | undefined> {
    const found = this.categories.find((category) => category.slug === slug && category.active)

    return found === undefined ? undefined : { ...found }
  }
}

export default FakeReportCategoryStore
