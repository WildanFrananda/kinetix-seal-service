import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"

import { contractBuildDigest } from "../../../src/infrastructure/midnight/contract_build_digest.ts"
import { credentialRegistryDirectory } from "../../../src/infrastructure/midnight/credential_registry_contract.ts"

let directory = ""

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "seal-digest-"))
  await mkdir(join(directory, "keys"))
  await writeFile(join(directory, "keys", "issue.verifier"), "issue key")
  await writeFile(join(directory, "keys", "present.verifier"), "present key")
  await writeFile(join(directory, "keys", "present.prover"), "a prover key is not part of the digest")
})

after(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe("the contract build digest", () => {
  it("is stable for the same verifier keys", async () => {
    assert.equal(await contractBuildDigest(directory), await contractBuildDigest(directory))
  })

  it("changes when a verifier key changes, and ignores prover keys", async () => {
    const before = await contractBuildDigest(directory)

    await writeFile(join(directory, "keys", "present.prover"), "another prover key")
    assert.equal(await contractBuildDigest(directory), before)

    await writeFile(join(directory, "keys", "present.verifier"), "another present key")
    assert.notEqual(await contractBuildDigest(directory), before)
  })

  it("refuses a contract compiled without keys", async () => {
    const empty = await mkdtemp(join(tmpdir(), "seal-digest-empty-"))

    await mkdir(join(empty, "keys"))
    await assert.rejects(contractBuildDigest(empty), /holds no verifier key/)
    await rm(empty, { recursive: true, force: true })
  })

  it("reads the compiled credential registry", async () => {
    assert.match(await contractBuildDigest(credentialRegistryDirectory), /^[0-9a-f]{64}$/)
  })
})
