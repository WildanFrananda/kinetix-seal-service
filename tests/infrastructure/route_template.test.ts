import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { requestIdOf } from "../../src/infrastructure/http/request_id.ts"
import { routeTemplate } from "../../src/infrastructure/http/route_template.ts"

describe("metric labels", () => {
  it("label a route by its template, never by its values", () => {
    assert.equal(routeTemplate("/credentials/:credentialId"), "/credentials/{credentialId}")
  })

  it("put every unmatched path in one bucket", () => {
    assert.equal(routeTemplate(undefined), "unmatched")
  })
})

describe("the request id", () => {
  it("keeps a caller's well-formed id", () => {
    assert.equal(requestIdOf("req-123"), "req-123")
  })

  it("replaces an id that could carry anything", () => {
    assert.notEqual(requestIdOf("a b\nforged"), "a b\nforged")
  })
})
