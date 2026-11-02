import type { PredicatePlacementStorePort } from "../../src/application/ports/predicate_placement_store.port.ts"
import type { PlacedPredicate } from "../../src/types/placed_predicate.type.ts"

class FakePredicatePlacementStore implements PredicatePlacementStorePort {
  generation: number | undefined
  placed: PlacedPredicate[] = []
  replacements = 0

  async replace(generation: number, placed: readonly PlacedPredicate[], _at: Date): Promise<void> {
    this.generation = generation
    this.placed = [...placed]
    this.replacements += 1
  }

  async ofGeneration(generation: number): Promise<PlacedPredicate[]> {
    return this.generation === generation ? [...this.placed] : []
  }
}

export default FakePredicatePlacementStore
