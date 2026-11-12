import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import { signingKeyFromBip340 } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime"

import { maintenanceSigningKey } from "../../../src/infrastructure/midnight/maintenance_signing_key.ts"

const issuerSecret = new Uint8Array(32).fill(7)

describe("the maintenance signing key", () => {
  it("is derived again from the issuer secret, so nothing has to store it", () => {
    assert.deepEqual(
      maintenanceSigningKey(issuerSecret, "credential", 1),
      maintenanceSigningKey(issuerSecret, "credential", 1)
    )
  })

  it("is the credential registry's key from before the report registry, so its live generation stays maintainable", () => {
    const before = signingKeyFromBip340(
      createHash("sha256")
        .update("kinetix:seal:maintenance")
        .update(issuerSecret)
        .update(Buffer.from([0, 0, 0, 49]))
        .digest()
    )

    assert.deepEqual(maintenanceSigningKey(issuerSecret, "credential", 49), before)
  })

  it("differs per registry, per generation and per issuer secret", () => {
    const key = maintenanceSigningKey(issuerSecret, "credential", 1)

    assert.notDeepEqual(key, maintenanceSigningKey(issuerSecret, "report", 1))
    assert.notDeepEqual(key, maintenanceSigningKey(issuerSecret, "credential", 2))
    assert.notDeepEqual(key, maintenanceSigningKey(new Uint8Array(32).fill(8), "credential", 1))
  })

  it("does not carry the issuer secret", () => {
    assert.ok(!maintenanceSigningKey(issuerSecret, "credential", 1).value.includes("07".repeat(32)))
    assert.ok(!maintenanceSigningKey(issuerSecret, "report", 1).value.includes("07".repeat(32)))
  })
})
