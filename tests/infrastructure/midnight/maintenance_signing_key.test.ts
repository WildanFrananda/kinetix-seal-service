import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { maintenanceSigningKey } from "../../../src/infrastructure/midnight/maintenance_signing_key.ts"

const issuerSecret = new Uint8Array(32).fill(7)

describe("the maintenance signing key", () => {
  it("is derived again from the issuer secret, so nothing has to store it", () => {
    assert.equal(maintenanceSigningKey(issuerSecret, 1), maintenanceSigningKey(issuerSecret, 1))
  })

  it("differs per generation and per issuer secret", () => {
    assert.notEqual(maintenanceSigningKey(issuerSecret, 1), maintenanceSigningKey(issuerSecret, 2))
    assert.notEqual(maintenanceSigningKey(issuerSecret, 1), maintenanceSigningKey(new Uint8Array(32).fill(8), 1))
  })

  it("does not carry the issuer secret", () => {
    assert.ok(!maintenanceSigningKey(issuerSecret, 1).includes("07".repeat(32)))
  })
})
