import { Gauge, type Registry } from "prom-client"

import type { SponsorGaugesPort } from "../../application/ports/sponsor_gauges.port.ts"
import type { SponsorCondition } from "../../types/sponsor_condition.type.ts"
import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"

const conditions: readonly SponsorCondition[] = ["syncing", "healthy", "low_dust", "no_dust"]
const speckPerDust = 1e15

class PrometheusSponsorGauges implements SponsorGaugesPort {
  readonly #synced: Gauge
  readonly #dustBalance: Gauge
  readonly #dustCoins: Gauge
  readonly #nightUtxos: Gauge
  readonly #condition: Gauge<"condition">
  readonly #restoreSeconds: Gauge

  constructor(registry: Registry) {
    this.#synced = new Gauge({
      name: "kinetix_seal_sponsor_synced",
      help: "1 when the sponsor wallet has caught up with the chain",
      registers: [registry]
    })
    this.#dustBalance = new Gauge({
      name: "kinetix_seal_sponsor_dust_balance",
      help: "DUST the sponsor wallet can spend now, in DUST",
      registers: [registry]
    })
    this.#dustCoins = new Gauge({
      name: "kinetix_seal_sponsor_dust_coins",
      help: "DUST coins the sponsor wallet can spend now",
      registers: [registry]
    })
    this.#nightUtxos = new Gauge({
      name: "kinetix_seal_sponsor_night_utxos",
      help: "NIGHT UTXOs the sponsor wallet holds",
      registers: [registry]
    })
    this.#condition = new Gauge({
      name: "kinetix_seal_sponsor_condition",
      help: "1 for the sponsor wallet's current condition, 0 for the others",
      labelNames: ["condition"],
      registers: [registry]
    })
    this.#restoreSeconds = new Gauge({
      name: "kinetix_seal_sponsor_restore_seconds",
      help: "How long the sponsor wallet took to restore its saved state at start",
      registers: [registry]
    })

    for (const condition of conditions) {
      this.#condition.set({ condition }, condition === "syncing" ? 1 : 0)
    }
  }

  observe(snapshot: SponsorSnapshot, condition: SponsorCondition): void {
    this.#synced.set(snapshot.synced ? 1 : 0)
    this.#dustBalance.set(Number(snapshot.dustBalance) / speckPerDust)
    this.#dustCoins.set(snapshot.dustCoins)
    this.#nightUtxos.set(snapshot.nightUtxos)

    for (const candidate of conditions) {
      this.#condition.set({ condition: candidate }, candidate === condition ? 1 : 0)
    }
  }

  restored(seconds: number): void {
    this.#restoreSeconds.set(seconds)
  }
}

export default PrometheusSponsorGauges
