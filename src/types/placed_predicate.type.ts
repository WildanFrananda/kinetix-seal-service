import type { RegistryPredicate } from "./registry_predicate.type.ts"

type PlacedPredicate = {
  id: Uint8Array
  predicate: RegistryPredicate
}

export type { PlacedPredicate }
