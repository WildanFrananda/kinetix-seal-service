import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { presentationRequest } from "./holder_presentations.ts"
import { presentedCalls } from "./presented_calls.ts"

const holderRoot = "dist/holder-bundle"
const answers = new Map<string, Record<string, string>>()
const waiting = new Map<string, (answer: Record<string, string>) => void>()

function answerTo(id: string): Promise<Record<string, string>> {
  const known = answers.get(id)

  if (known !== undefined) {
    return Promise.resolve(known)
  }

  return new Promise((resolve) => {
    waiting.set(id, resolve)
  })
}

const networkFetch = globalThis.fetch

Reflect.set(globalThis, "SealHolderBridge", {
  postMessage(message: string): void {
    const answer: Record<string, string> = JSON.parse(message)
    const id = answer.id ?? ""

    answers.set(id, answer)
    waiting.get(id)?.(answer)
  }
})

Reflect.set(globalThis, "fetch", async function fileFetch(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : String(input))

  if (url.protocol !== "file:") {
    return networkFetch(input, init)
  }

  const type = url.pathname.endsWith(".wasm") ? "application/wasm" : "application/octet-stream"

  return new Response(await readFile(fileURLToPath(url)), { headers: { "content-type": type } })
})

describe("the holder bundle a phone runs", () => {
  it("starts, and answers through the app's bridge", async () => {
    const { digest } = JSON.parse(await readFile(join(holderRoot, "current.json"), "utf8"))

    await import(pathToFileURL(join(holderRoot, digest, "holder.js")).href)

    assert.equal((await answerTo("ready")).ok, "true")
  })

  it("computes the contract's holder key and proves a present call, without any GPL code", async () => {
    const holder = Reflect.get(globalThis, "sealHolder")
    const { registry, holderSecret, request } = await presentationRequest(20_725)

    holder.holderPublicKey("key", holderSecret.toString("hex"))
    holder.present("present", JSON.stringify(request))

    assert.equal((await answerTo("key")).holderPublicKey, pureCircuits.holderPublicKey(holderSecret).toString())

    const presented = await answerTo("present")

    assert.equal(presented.ok, "true", presented.error ?? "no error")
    assert.deepEqual(presentedCalls(presented.transaction ?? ""), [
      { address: registry.contractAddress(), entryPoint: "present" }
    ])
  })

  it("names an error to the app rather than failing silently", async () => {
    Reflect.get(globalThis, "sealHolder").present("broken", "{}")

    const broken = await answerTo("broken")

    assert.equal(broken.ok, "false")
    assert.match(broken.error ?? "", /snapshot/)
  })
})
