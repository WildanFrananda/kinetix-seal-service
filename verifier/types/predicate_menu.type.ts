import type { PredicateChoice } from "./predicate_choice.type.ts"

type PredicateMenu = {
  contractAddress: string
  choices: PredicateChoice[]
  rows: PredicateChoice[]
}

export type { PredicateMenu }
