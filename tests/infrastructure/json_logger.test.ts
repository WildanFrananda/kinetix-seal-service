import assert from "node:assert/strict"
import { describe, it } from "node:test"

import JsonLogger from "../../src/infrastructure/observability/json_logger.ts"

function capture(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = []

  function write(line: string): void {
    lines.push(line)
  }

  return { lines, write }
}

describe("the JSON logger", () => {
  it("writes one JSON line with the estate's fields", () => {
    const output = capture()

    new JsonLogger("kinetix-seal-service", "info", output.write).info({
      message: "the sponsor wallet changed",
      requestId: "abc",
      fields: { dust_coins: 10, dust_balance_speck: 5n }
    })

    const line = JSON.parse(output.lines[0] ?? "")

    assert.equal(line.level, "info")
    assert.equal(line.logger, "kinetix-seal-service")
    assert.equal(line.request_id, "abc")
    assert.equal(line.dust_coins, 10)
    assert.equal(line.dust_balance_speck, "5")
  })

  it("keeps a field from overwriting a reserved key", () => {
    const output = capture()

    new JsonLogger("seal", "info", output.write).info({ message: "real", fields: { message: "forged" } })

    const line = JSON.parse(output.lines[0] ?? "")

    assert.equal(line.message, "real")
    assert.equal(line.field_message, "forged")
  })

  it("drops events below its level", () => {
    const output = capture()

    new JsonLogger("seal", "warn", output.write).info({ message: "quiet" })

    assert.equal(output.lines.length, 0)
  })
})
