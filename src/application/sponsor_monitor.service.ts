import { sponsorConditionOf } from "../domain/sponsor_condition.ts"
import { isSponsorEventDue } from "../domain/sponsor_event_due.ts"
import type { SponsorCondition } from "../types/sponsor_condition.type.ts"
import type { SponsorEvent } from "../types/sponsor_event.type.ts"
import type { SponsorThresholds } from "../types/sponsor_thresholds.type.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { SponsorConditionSourcePort } from "./ports/sponsor_condition_source.port.ts"
import type { SponsorEventStorePort } from "./ports/sponsor_event_store.port.ts"
import type { SponsorGaugesPort } from "./ports/sponsor_gauges.port.ts"
import type { SponsorWalletPort } from "./ports/sponsor_wallet.port.ts"

class SponsorMonitor implements SponsorConditionSourcePort {
  private readonly wallet: SponsorWalletPort
  private readonly events: SponsorEventStorePort
  private readonly gauges: SponsorGaugesPort
  private readonly logger: LoggerPort
  private readonly thresholds: SponsorThresholds
  private current: SponsorCondition = "syncing"
  private lastEvent: SponsorEvent | undefined

  constructor(
    wallet: SponsorWalletPort,
    events: SponsorEventStorePort,
    gauges: SponsorGaugesPort,
    logger: LoggerPort,
    thresholds: SponsorThresholds
  ) {
    this.wallet = wallet
    this.events = events
    this.gauges = gauges
    this.logger = logger
    this.thresholds = thresholds
  }

  condition(): SponsorCondition {
    return this.current
  }

  async resume(): Promise<void> {
    this.lastEvent = await this.events.latest()
  }

  async observe(): Promise<SponsorCondition> {
    const snapshot = await this.wallet.snapshot()
    const condition = sponsorConditionOf(snapshot, this.thresholds)

    this.current = condition
    this.gauges.observe(snapshot, condition)

    if (!isSponsorEventDue(this.lastEvent, condition, snapshot.dustCoins, snapshot.nightUtxos)) {
      return condition
    }

    const event: SponsorEvent = {
      occurredAt: snapshot.observedAt,
      condition,
      dustBalance: snapshot.dustBalance,
      dustCoins: snapshot.dustCoins,
      nightUtxos: snapshot.nightUtxos
    }

    await this.events.record(event)
    this.lastEvent = event

    this.logger.info({
      message: "the sponsor wallet changed",
      fields: {
        condition,
        dust_coins: snapshot.dustCoins,
        night_utxos: snapshot.nightUtxos,
        dust_balance_speck: snapshot.dustBalance.toString()
      }
    })

    return condition
  }
}

export default SponsorMonitor
