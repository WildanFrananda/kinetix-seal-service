import type { PredicateChoice } from "../types/predicate_choice.type.ts"

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function minimumLinesOf(choice: PredicateChoice): string[] {
  return [
    `At least ${counted(choice.deliveries, "delivery", "deliveries")}`,
    `A rating of at least ${(choice.ratingHundredths / 100).toFixed(2)}`,
    `Active for at least ${counted(choice.daysActive, "day", "days")}`,
    `Numbers as of ${choice.issuedSince} or later`
  ]
}

export { minimumLinesOf }
