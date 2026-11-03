type RelayAnswer = { kind: "relayed" } | { kind: "refused"; message: string } | { kind: "unavailable" }

export type { RelayAnswer }
