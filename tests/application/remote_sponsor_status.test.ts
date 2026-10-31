import assert from "node:assert/strict"
import { describe, it } from "node:test"

import RemoteSponsorStatus from "../../src/application/remote_sponsor_status.service.ts"
import FakeSponsorStateSource from "../fakes/fake_sponsor_state_source.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { snapshot } from "../fakes/snapshot.ts"

describe("the sponsor's status, seen from the service", () => {
  it("is unreachable until the sponsor has answered once", () => {
    assert.equal(
      new RemoteSponsorStatus(new FakeSponsorStateSource(), new RecordingLogger()).condition(),
      "unreachable"
    )
  })

  it("takes the sponsor's own condition, and logs a change once", async () => {
    const source = new FakeSponsorStateSource()
    const logger = new RecordingLogger()
    const status = new RemoteSponsorStatus(source, logger)

    source.next = { condition: "syncing", snapshot: snapshot({ synced: false }) }
    assert.equal(await status.refresh(), "syncing")

    source.next = { condition: "healthy", snapshot: snapshot({}) }
    await status.refresh()
    await status.refresh()

    assert.equal(status.condition(), "healthy")
    assert.equal(logger.lines.filter((line) => line.message === "the sponsor's condition changed").length, 2)
  })

  it("turns unreachable when the sponsor stops answering, and says why once", async () => {
    const source = new FakeSponsorStateSource()
    const logger = new RecordingLogger()
    const status = new RemoteSponsorStatus(source, logger)

    await status.refresh()
    source.next = new Error("connect ECONNREFUSED 172.18.0.40:8014")
    await status.refresh()
    await status.refresh()

    assert.equal(status.condition(), "unreachable")
    assert.equal(logger.lines.filter((line) => line.message === "the sponsor cannot be reached").length, 1)
  })
})
