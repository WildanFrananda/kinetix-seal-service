import type { Ledger } from "#contracts/credential_registry/contract/index.js"
import type { PlacedPredicate } from "../../types/placed_predicate.type.ts"

function placedPredicatesOf(predicates: Ledger["predicates"]): PlacedPredicate[] {
  const placed: PlacedPredicate[] = []

  for (const [id, predicate] of predicates) {
    placed.push({ id, predicate: { classId: predicate.classId, minimums: [...predicate.minimums] } })
  }

  return placed
}

export { placedPredicatesOf }
