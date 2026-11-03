import type { AnswerStatus } from "../types/answer_status.type.ts"
import type { RelayAnswer } from "../types/relay_answer.type.ts"

const sealPath = "/api/v1/seal"

async function readPredicates(): Promise<unknown> {
  const response = await fetch(`${sealPath}/predicates`, { cache: "no-cache" })

  if (!response.ok) {
    throw new Error(`the predicates answered ${response.status}`)
  }

  return response.json()
}

async function relayAnswer(transactionHex: string): Promise<RelayAnswer> {
  let response: Response

  try {
    response = await fetch(`${sealPath}/presentations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transaction: transactionHex })
    })
  } catch {
    return { kind: "unavailable" }
  }

  if (response.status === 202) {
    return { kind: "relayed" }
  }

  if (response.status === 400 || response.status === 413 || response.status === 422) {
    const body: unknown = await response.json().catch(() => undefined)
    const message = typeof body === "object" && body !== null ? Reflect.get(body, "message") : undefined

    return { kind: "refused", message: typeof message === "string" ? message : "the answer was refused" }
  }

  return { kind: "unavailable" }
}

async function answerStatus(challenge: string): Promise<AnswerStatus> {
  let response: Response

  try {
    response = await fetch(`${sealPath}/presentations/${challenge}`, { cache: "no-store" })
  } catch {
    return { kind: "unavailable" }
  }

  if (!response.ok) {
    return { kind: "unavailable" }
  }

  const body: unknown = await response.json().catch(() => undefined)
  const status = typeof body === "object" && body !== null ? Reflect.get(body, "status") : undefined
  const predicateId = typeof body === "object" && body !== null ? Reflect.get(body, "predicateId") : undefined

  if (status === "answered" && typeof predicateId === "string") {
    return { kind: "answered", predicateId }
  }

  return status === "unanswered" ? { kind: "unanswered" } : { kind: "unavailable" }
}

export { answerStatus, readPredicates, relayAnswer }
