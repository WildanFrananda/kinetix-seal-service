import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { describe, it } from "node:test"
import { Zkir } from "@midnightntwrk/zkir-v3"
import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import HolderRuntime from "../../holder/src/holder_runtime.ts"
import { fileAsset } from "./file_assets.ts"
import { presentationRequest } from "./holder_presentations.ts"
import { presentedCalls } from "./presented_calls.ts"

describe("the holder runtime", () => {
  it("proves a present call on the registry from the holder's own secret and credential", async () => {
    const runtime = new HolderRuntime(fileAsset)
    const { registry, request } = await presentationRequest(20_725)
    const transaction = await runtime.present(request)

    assert.deepEqual(presentedCalls(transaction), [{ address: registry.contractAddress(), entryPoint: "present" }])
  })

  it("refuses, before any proof, a credential older than the predicate allows", async () => {
    const runtime = new HolderRuntime(fileAsset)
    const { request } = await presentationRequest(20_724)

    await assert.rejects(runtime.present(request), /does not meet the predicate/)
  })

  it("computes the holder key the contract computes", () => {
    const secret = randomBytes(32)

    assert.equal(
      new HolderRuntime(fileAsset).holderPublicKey(secret.toString("hex")),
      pureCircuits.holderPublicKey(secret).toString()
    )
  })

  it("refuses a request that is not a presentation", async () => {
    const runtime = new HolderRuntime(fileAsset)
    const { request } = await presentationRequest(20_725)

    for (const broken of [
      { ...request, challenge: "AB".repeat(32) },
      { ...request, leafIndex: -1 },
      { ...request, credential: { ...request.credential, attributes: ["1", "2", "3"] } },
      "not an object"
    ]) {
      await assert.rejects(runtime.present(broken))
    }

    assert.throws(() => runtime.holderPublicKey("00"), /32 bytes/)
  })

  it("loads its key material once, and again after a failure", async () => {
    const asked: string[] = []
    let failing = true
    const runtime = new HolderRuntime(async function counted(name: string): Promise<Uint8Array> {
      asked.push(name)

      if (failing) {
        throw new Error("offline")
      }

      return fileAsset(name)
    })

    await assert.rejects(runtime.prepare(), /offline/)
    failing = false
    await runtime.prepare()
    await runtime.prepare()

    assert.equal(asked.filter((name) => name === "present.prover").length, 2)
    assert.ok(asked.includes(`bls_midnight_2p${Zkir.deserialize(await fileAsset("present.bzkir")).getK()}`))
  })
})
