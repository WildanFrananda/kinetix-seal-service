import { Agent, request } from "node:https"
import type { PeerCertificate } from "node:tls"

import type { SponsorStateSourcePort } from "../../application/ports/sponsor_state_source.port.ts"
import type { TransactionPayerPort } from "../../application/ports/transaction_payer.port.ts"
import NothingSubmitted from "../../domain/nothing_submitted.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import type { SponsorState } from "../../types/sponsor_state.type.ts"
import { serviceOfCertificate } from "../mesh/spiffe.ts"
import { fromWireState } from "./sponsor_state_wire.ts"

const server = "seal"
const declinedStatuses: readonly number[] = [400, 403, 404, 413, 422, 503]

class HttpsSponsorClient implements SponsorStateSourcePort, TransactionPayerPort {
  private readonly base: URL
  private readonly agent: Agent
  private readonly timeoutSeconds: number
  private readonly payTimeoutSeconds: number

  constructor(url: string, identity: MeshIdentity, timeoutSeconds: number, payTimeoutSeconds: number) {
    this.base = new URL(url)
    this.timeoutSeconds = timeoutSeconds
    this.payTimeoutSeconds = payTimeoutSeconds
    this.agent = new Agent({
      keepAlive: true,
      ca: identity.authority,
      cert: identity.certificate,
      key: identity.privateKey,
      minVersion: "TLSv1.3",
      checkServerIdentity(_hostname: string, certificate: PeerCertificate): Error | undefined {
        const service = serviceOfCertificate(certificate.subjectaltname, identity.trustDomains)

        return service === server ? undefined : new Error(`the sponsor answered as ${service ?? "no mesh service"}`)
      }
    })
  }

  async state(): Promise<SponsorState> {
    return fromWireState(await this.send("GET", "/v1/state", undefined, this.timeoutSeconds))
  }

  async pay(unboundTransaction: Uint8Array): Promise<string> {
    return this.spend("/v1/transactions/pay", unboundTransaction)
  }

  async sponsor(boundTransaction: Uint8Array): Promise<string> {
    return this.spend("/v1/transactions/sponsor", boundTransaction)
  }

  close(): void {
    this.agent.destroy()
  }

  private async spend(path: string, transaction: Uint8Array): Promise<string> {
    const body = await this.send(
      "POST",
      path,
      { transaction: Buffer.from(transaction).toString("hex") },
      this.payTimeoutSeconds
    )

    const txId = (body as { txId?: unknown } | null)?.txId

    if (typeof txId !== "string" || txId === "") {
      throw new Error("the sponsor paid without naming the transaction")
    }

    return txId
  }

  private send(method: string, path: string, body: unknown, timeoutSeconds: number): Promise<unknown> {
    const payload = body === undefined ? undefined : JSON.stringify(body)

    return new Promise((resolve, reject) => {
      const outgoing = request(
        new URL(path, this.base),
        {
          method,
          agent: this.agent,
          timeout: timeoutSeconds * 1000,
          headers: payload === undefined ? {} : { "content-type": "application/json" }
        },
        (response) => {
          const chunks: Buffer[] = []

          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk)
          })

          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8")
            const parsed: unknown = text === "" ? null : JSON.parse(text)

            if (response.statusCode !== 200) {
              const message = (parsed as { message?: unknown } | null)?.message
              const answer = `the sponsor answered ${response.statusCode}: ${typeof message === "string" ? message : text}`

              reject(
                declinedStatuses.includes(response.statusCode ?? 0) ? new NothingSubmitted(answer) : new Error(answer)
              )

              return
            }

            resolve(parsed)
          })
        }
      )

      outgoing.on("timeout", () => {
        outgoing.destroy(new Error(`the sponsor did not answer ${method} ${path} within ${timeoutSeconds} s`))
      })

      outgoing.on("error", (error: NodeJS.ErrnoException) => {
        reject(
          error.code === "ECONNREFUSED"
            ? new NothingSubmitted(`the sponsor refused the connection for ${method} ${path}`, { cause: error })
            : error
        )
      })

      outgoing.end(payload)
    })
  }
}

export default HttpsSponsorClient
