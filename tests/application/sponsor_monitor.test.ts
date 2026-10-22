import assert from "node:assert/strict"
import { describe, it } from "node:test"

import SponsorMonitor from "../../src/application/sponsor_monitor.service.ts"
import FakeSponsorEventStore from "../fakes/fake_sponsor_event_store.ts"
import FakeSponsorWallet from "../fakes/fake_sponsor_wallet.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingSponsorGauges from "../fakes/recording_sponsor_gauges.ts"
import { snapshot } from "../fakes/snapshot.ts"

const thresholds = { minimumDustCoins: 3, minimumDust: 1n }

function monitorWith(wallet: FakeSponsorWallet, events: FakeSponsorEventStore): SponsorMonitor {
  return new SponsorMonitor(wallet, events, new RecordingSponsorGauges(), new RecordingLogger(), thresholds)
}

describe("the sponsor monitor", () => {
  it("reports syncing before it has observed anything", () => {
    const monitor = monitorWith(new FakeSponsorWallet(snapshot({})), new FakeSponsorEventStore())

    assert.equal(monitor.condition(), "syncing")
  })

  it("records a change once and stays quiet while nothing changes", async () => {
    const wallet = new FakeSponsorWallet(snapshot({}))
    const events = new FakeSponsorEventStore()
    const monitor = monitorWith(wallet, events)

    await monitor.observe()
    await monitor.observe()

    assert.equal(events.recorded.length, 1)
    assert.equal(events.recorded[0]?.condition, "healthy")
  })

  it("records the loss of every DUST coin", async () => {
    const wallet = new FakeSponsorWallet(snapshot({}))
    const events = new FakeSponsorEventStore()
    const monitor = monitorWith(wallet, events)

    await monitor.observe()
    wallet.next = snapshot({ dustCoins: 0, dustBalance: 0n })

    assert.equal(await monitor.observe(), "no_dust")
    assert.deepEqual(
      events.recorded.map((event) => event.condition),
      ["healthy", "no_dust"]
    )
  })

  it("resumes from the last recorded event, so a restart does not repeat it", async () => {
    const events = new FakeSponsorEventStore()

    await monitorWith(new FakeSponsorWallet(snapshot({})), events).observe()

    const restarted = monitorWith(new FakeSponsorWallet(snapshot({})), events)

    await restarted.resume()
    await restarted.observe()

    assert.equal(events.recorded.length, 1)
  })
})
