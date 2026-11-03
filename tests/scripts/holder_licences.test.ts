import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { licenceRefusals } from "../../scripts/holder_licences.ts"

function bundled(name: string, licence: string | undefined) {
  return { name, version: "1.0.0", licence, directory: `node_modules/${name}` }
}

describe("the holder bundle's licence gate", () => {
  it("lets through permissive licences and the Midnight WASM packages whose source is Apache-2.0", () => {
    assert.deepEqual(
      licenceRefusals([
        bundled("effect", "MIT"),
        bundled("ieee754", "BSD-3-Clause"),
        bundled("@midnight-ntwrk/ledger-v8", undefined),
        bundled("@midnight-ntwrk/compact-runtime", "Apache-2.0")
      ]),
      []
    )
  })

  it("refuses copyleft, source-available and unknown licences", () => {
    assert.deepEqual(
      licenceRefusals([
        bundled("@subsquid/scale-codec", "GPL-3.0-or-later"),
        bundled("a", "LGPL-2.1"),
        bundled("b", "AGPL-3.0"),
        bundled("c", "BUSL-1.1"),
        bundled("d", undefined)
      ]),
      [
        "@subsquid/scale-codec@1.0.0 is GPL-3.0-or-later",
        "a@1.0.0 is LGPL-2.1",
        "b@1.0.0 is AGPL-3.0",
        "c@1.0.0 is BUSL-1.1",
        "d@1.0.0 carries no licence"
      ]
    )
  })
})
