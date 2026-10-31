import type { SponsorCondition } from "../../types/sponsor_condition.type.ts"
import type { SponsorState } from "../../types/sponsor_state.type.ts"

const conditions: readonly SponsorCondition[] = ["syncing", "healthy", "low_dust", "no_dust"]

function toWireState(state: SponsorState): Record<string, unknown> {
  return {
    condition: state.condition,
    synced: state.snapshot.synced,
    dustBalanceSpeck: state.snapshot.dustBalance.toString(),
    dustCoins: state.snapshot.dustCoins,
    nightUtxos: state.snapshot.nightUtxos,
    observedAt: state.snapshot.observedAt.toISOString()
  }
}

function fromWireState(body: unknown): SponsorState {
  if (typeof body !== "object" || body === null) {
    throw new Error("the sponsor answered no state")
  }

  const wire = body as Record<string, unknown>
  const condition = conditions.find((candidate) => candidate === wire.condition)

  if (
    condition === undefined ||
    typeof wire.synced !== "boolean" ||
    typeof wire.dustBalanceSpeck !== "string" ||
    !/^[0-9]+$/.test(wire.dustBalanceSpeck) ||
    typeof wire.dustCoins !== "number" ||
    typeof wire.nightUtxos !== "number" ||
    typeof wire.observedAt !== "string"
  ) {
    throw new Error("the sponsor answered a state this service cannot read")
  }

  return {
    condition,
    snapshot: {
      synced: wire.synced,
      dustBalance: BigInt(wire.dustBalanceSpeck),
      dustCoins: wire.dustCoins,
      nightUtxos: wire.nightUtxos,
      observedAt: new Date(wire.observedAt)
    }
  }
}

export { fromWireState, toWireState }
