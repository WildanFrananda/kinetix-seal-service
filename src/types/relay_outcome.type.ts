type RelayOutcome =
  | { kind: "relayed"; txId: string }
  | { kind: "not_a_presentation"; reason: string }
  | { kind: "no_registry" }
  | { kind: "sponsor_unavailable"; reason: string }

export type { RelayOutcome }
