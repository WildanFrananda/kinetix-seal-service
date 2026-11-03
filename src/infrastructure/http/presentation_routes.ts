import type { FastifyInstance } from "fastify"

import type { PresentationRouteDependencies } from "../../types/presentation_route_dependencies.type.ts"
import type { PresentationStatus } from "../../types/presentation_status.type.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const presentationsRoute = "/api/v1/seal/presentations"
const presentationRoute = "/api/v1/seal/presentations/:challenge"
const challengePattern = /^[0-9a-f]{64}$/
const requestBodyLimit = 16_384
const sponsorRetryAfterSeconds = 30
const transactionPattern = /^([0-9a-f]{2})+$/

function transactionOf(body: unknown): Uint8Array | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined
  }

  const keys = Object.keys(body)
  const hex: unknown = Reflect.get(body, "transaction")

  if (keys.length !== 1 || typeof hex !== "string" || !transactionPattern.test(hex)) {
    return undefined
  }

  return Buffer.from(hex, "hex")
}

function registerPresentationRoutes(server: FastifyInstance, dependencies: PresentationRouteDependencies): void {
  const { relay, statuses, logger, metrics } = dependencies

  metrics.httpRequests.inc({ method: "POST", route: routeTemplate(presentationsRoute), status: "202" }, 0)
  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(presentationRoute), status: "200" }, 0)

  server.get<{ Params: { challenge: string } }>(presentationRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const { challenge } = request.params

    if (!challengePattern.test(challenge)) {
      return reply.code(400).send(problem("INVALID_REQUEST", "a challenge is 32 bytes in lowercase hex", request.id))
    }

    let status: PresentationStatus | undefined

    try {
      status = await statuses.statusOf(challenge)
    } catch (error) {
      logger.warn({
        message: "the registry could not be read for a presentation",
        requestId: request.id,
        fields: { cause: error instanceof Error ? error.message : String(error) }
      })
    }

    if (status === undefined) {
      return reply
        .code(503)
        .header("Retry-After", String(sponsorRetryAfterSeconds))
        .send(problem("REGISTRY_UNAVAILABLE", "the registry cannot be read now; try again later", request.id))
    }

    return reply.code(200).send({
      status: status.predicateId === undefined ? "unanswered" : "answered",
      predicateId: status.predicateId ?? null,
      generation: status.generation
    })
  })

  server.post(presentationsRoute, { bodyLimit: requestBodyLimit }, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const transaction = transactionOf(request.body)

    if (transaction === undefined) {
      return reply
        .code(400)
        .send(problem("INVALID_REQUEST", "the body must be { transaction }, the bound transaction in hex", request.id))
    }

    const outcome = await relay.relay(transaction)

    switch (outcome.kind) {
      case "relayed":
        return reply.code(202).send({ txId: outcome.txId })
      case "not_a_presentation":
        return reply.code(422).send(problem("NOT_A_PRESENTATION", outcome.reason, request.id))
      case "no_registry":
        return reply
          .code(503)
          .header("Retry-After", String(sponsorRetryAfterSeconds))
          .send(problem("REGISTRY_UNAVAILABLE", "no registry is active now; try again later", request.id))
      case "sponsor_unavailable":
        logger.warn({
          message: "a presentation could not be handed to the sponsor",
          requestId: request.id,
          fields: { cause: outcome.reason }
        })

        return reply
          .code(503)
          .header("Retry-After", String(sponsorRetryAfterSeconds))
          .send(problem("SPONSOR_UNAVAILABLE", "the presentation cannot be sent now; try again later", request.id))
    }
  })
}

export { registerPresentationRoutes }
