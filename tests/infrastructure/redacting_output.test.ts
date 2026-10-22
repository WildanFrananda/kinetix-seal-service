import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { redacted } from "../../src/infrastructure/observability/redacting_output.ts"

describe("redaction", () => {
  it("hides the Blockfrost key inside the URL a dependency logs on disconnect", () => {
    const line =
      "RPC-CORE: disconnected from wss://rpc.midnight-preprod.blockfrost.io/?project_id=nightpreprodKEY: 1000"

    assert.equal(
      redacted(line, [{ value: "nightpreprodKEY", placeholder: "<project_id>" }]),
      "RPC-CORE: disconnected from wss://rpc.midnight-preprod.blockfrost.io/?project_id=<project_id>: 1000"
    )
  })

  it("hides every occurrence of every secret", () => {
    const secrets = [
      { value: "k3y", placeholder: "<project_id>" },
      { value: "one two three", placeholder: "<mnemonic>" }
    ]

    assert.equal(redacted("k3y one two three k3y", secrets), "<project_id> <mnemonic> <project_id>")
  })
})
