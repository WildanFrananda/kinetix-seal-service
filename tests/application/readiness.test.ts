import assert from "node:assert/strict"
import { describe, it } from "node:test"

import Readiness from "../../src/application/readiness.service.ts"
import FakeDatabaseProbe from "../fakes/fake_database_probe.ts"
import FixedSponsorCondition from "../fakes/fixed_sponsor_condition.ts"

describe("readiness", () => {
  it("is ready with a reachable database and a synced sponsor", async () => {
    const report = await new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("healthy")).report()

    assert.deepEqual(report, { ready: true, database: "reachable", sponsor: "healthy" })
  })

  it("is not ready while the sponsor wallet restores", async () => {
    const report = await new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("syncing")).report()

    assert.equal(report.ready, false)
  })

  it("is not ready while the sponsor cannot be reached", async () => {
    const report = await new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("unreachable")).report()

    assert.deepEqual(report, { ready: false, database: "reachable", sponsor: "unreachable" })
  })

  it("stays ready when the sponsor has no DUST, which is an alert, not an outage", async () => {
    const report = await new Readiness(new FakeDatabaseProbe(true), new FixedSponsorCondition("no_dust")).report()

    assert.equal(report.ready, true)
  })

  it("is not ready without the database", async () => {
    const report = await new Readiness(new FakeDatabaseProbe(false), new FixedSponsorCondition("healthy")).report()

    assert.deepEqual(report, { ready: false, database: "unreachable", sponsor: "healthy" })
  })
})
