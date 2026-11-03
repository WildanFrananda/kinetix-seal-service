import type { PredicateChoice } from "../types/predicate_choice.type.ts"
import type { PredicateMenu } from "../types/predicate_menu.type.ts"

function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined
}

function choicesOf(value: unknown, onlyCurrent: boolean): PredicateChoice[] {
  const predicate = objectOf(value)
  const minimums = objectOf(predicate?.minimums)
  const rows = Array.isArray(predicate?.rows) ? predicate.rows.map(objectOf) : []
  const label = predicate?.label
  const deliveries = minimums?.deliveries
  const ratingHundredths = minimums?.ratingHundredths
  const daysActive = minimums?.daysActive

  if (
    typeof label !== "string" ||
    typeof deliveries !== "number" ||
    typeof ratingHundredths !== "number" ||
    typeof daysActive !== "number"
  ) {
    return []
  }

  const choices: PredicateChoice[] = []

  for (const row of rows) {
    if (row === undefined || typeof row.id !== "string" || typeof row.minimumIssueDate !== "string") {
      continue
    }

    if (onlyCurrent && (row.current !== true || row.placed !== true)) {
      continue
    }

    choices.push({ label, rowId: row.id, deliveries, ratingHundredths, daysActive, issuedSince: row.minimumIssueDate })
  }

  return choices
}

function predicateMenuOf(listing: unknown): PredicateMenu | undefined {
  const body = objectOf(listing)
  const registry = objectOf(body?.registry)
  const contractAddress = registry?.contractAddress

  if (typeof contractAddress !== "string" || !Array.isArray(body?.predicates)) {
    return undefined
  }

  return {
    contractAddress,
    choices: body.predicates.flatMap((predicate: unknown) => choicesOf(predicate, true)),
    rows: body.predicates.flatMap((predicate: unknown) => choicesOf(predicate, false))
  }
}

function choiceWithRow(menu: PredicateMenu, rowId: string): PredicateChoice | undefined {
  return menu.rows.find((choice) => choice.rowId === rowId)
}

export { choiceWithRow, predicateMenuOf }
