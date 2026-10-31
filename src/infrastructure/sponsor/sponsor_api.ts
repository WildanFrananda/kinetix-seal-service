import type { TLSSocket } from "node:tls"
import Fastify, { type FastifyInstance } from "fastify"

import SponsorUnavailable from "../../domain/sponsor_unavailable.ts"
import type { SponsorApiDependencies } from "../../types/sponsor_api_dependencies.type.ts"
import { serviceOfCertificate } from "../mesh/spiffe.ts"
import { toWireState } from "./sponsor_state_wire.ts"

const caller = "seal"
const maximumTransactionBytes = 1_048_576

function buildSponsorApi(dependencies: SponsorApiDependencies): FastifyInstance {
  const { identity, state, payer, logger } = dependencies
  const server = Fastify({
    logger: false,
    bodyLimit: maximumTransactionBytes * 2 + 1024,
    https: {
      key: identity.privateKey,
      cert: identity.certificate,
      ca: identity.authority,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.3"
    }
  })

  server.addHook("onRequest", async (request, reply) => {
    const peer = (request.raw.socket as TLSSocket).getPeerCertificate()
    const service = serviceOfCertificate(peer.subjectaltname, identity.trustDomains)

    if (service !== caller) {
      return reply.code(403).send({
        error: "peer_refused",
        message: `only ${caller} may use the sponsor; this caller is ${service ?? "unnamed"}`
      })
    }

    return undefined
  })

  server.setErrorHandler(async (error, request, reply) => {
    logger.error({ message: "a sponsor request failed", requestId: request.id }, error)

    return reply.code(500).send({ error: "sponsor_failed", message: "the sponsor could not complete the request" })
  })

  server.get("/v1/state", async () => {
    return toWireState(await state.state())
  })

  server.post("/v1/transactions/pay", async (request, reply) => {
    const body = request.body as { transaction?: unknown } | undefined
    const hex = body?.transaction

    if (typeof hex !== "string" || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
      return reply.code(400).send({ error: "invalid_transaction", message: "transaction must be lowercase hex" })
    }

    if (hex.length / 2 > maximumTransactionBytes) {
      return reply.code(413).send({ error: "transaction_too_large", message: "a transaction is at most 1 MiB" })
    }

    const current = await state.state()

    if (current.condition === "syncing") {
      return reply.code(503).send({ error: "sponsor_syncing", message: "the sponsor wallet is still syncing" })
    }

    try {
      return { txId: await payer.pay(Buffer.from(hex, "hex")) }
    } catch (error) {
      if (error instanceof SponsorUnavailable) {
        return reply.code(503).send({ error: "sponsor_unavailable", message: error.message })
      }

      throw error
    }
  })

  return server
}

export { buildSponsorApi }
