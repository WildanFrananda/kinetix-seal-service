import type { PlacedPredicate } from "../../types/placed_predicate.type.ts"

interface PredicatePlacementStorePort {
  replace(generation: number, placed: readonly PlacedPredicate[], at: Date): Promise<void>
  ofGeneration(generation: number): Promise<PlacedPredicate[]>
}

export type { PredicatePlacementStorePort }
