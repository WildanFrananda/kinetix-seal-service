import type { HolderAnswer } from "../types/holder_answer.type.ts"
import type { HolderBridge } from "../types/holder_bridge.type.ts"
import HolderRuntime from "./holder_runtime.ts"

function bridge(): HolderBridge {
  const candidate: unknown = Reflect.get(globalThis, "SealHolderBridge")

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof Reflect.get(candidate, "postMessage") !== "function"
  ) {
    throw new Error("the app provides no SealHolderBridge")
  }

  return {
    postMessage(message: string): void {
      Reflect.apply(Reflect.get(candidate, "postMessage"), candidate, [message])
    }
  }
}

async function fetchAsset(name: string): Promise<Uint8Array> {
  const response = await fetch(new URL(name, import.meta.url), { cache: "force-cache" })

  if (!response.ok) {
    throw new Error(`${name} answered ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

const runtime = new HolderRuntime(fetchAsset)

function answer(id: string, work: () => Promise<HolderAnswer>): void {
  work().then(
    (result) => {
      bridge().postMessage(JSON.stringify({ ...result, id, ok: "true" }))
    },
    (error: unknown) => {
      bridge().postMessage(
        JSON.stringify({ id, ok: "false", error: error instanceof Error ? error.message : String(error) })
      )
    }
  )
}

const sealHolder = {
  prepare(id: string): void {
    answer(id, async function prepared(): Promise<HolderAnswer> {
      await runtime.prepare()

      return {}
    })
  },
  holderPublicKey(id: string, secret: string): void {
    answer(id, async function computed(): Promise<HolderAnswer> {
      return { holderPublicKey: runtime.holderPublicKey(secret) }
    })
  },
  present(id: string, request: string): void {
    answer(id, async function presented(): Promise<HolderAnswer> {
      return { transaction: await runtime.present(JSON.parse(request)) }
    })
  }
}

Reflect.set(globalThis, "sealHolder", sealHolder)
bridge().postMessage(JSON.stringify({ id: "ready", ok: "true" }))
