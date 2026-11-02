import type { FastifyInstance } from "fastify"

import { hexOf } from "../../domain/hex.ts"
import { parseHolderPublicKey } from "../../domain/holder_public_key.ts"
import type { CredentialRouteDependencies } from "../../types/credential_route_dependencies.type.ts"
import type { CredentialStatus } from "../../types/credential_status.type.ts"
import type { CredentialView } from "../../types/credential_view.type.ts"
import { callerOf } from "./caller_of.ts"
import { isLowercaseUuid } from "./lowercase_uuid.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const collectionRoute = "/api/v1/seal/courier-credentials"
const memberRoute = "/api/v1/seal/courier-credentials/:id"
const requestBodyLimit = 1024
const factsRetryAfterSeconds = 60

function viewOf(status: CredentialStatus): CredentialView {
  const { credential, standing, placement } = status

  return {
    id: credential.id,
    status: standing,
    issueDay: credential.issueDay,
    credential: {
      classId: hexOf(credential.classId),
      attributes: credential.attributes.map((attribute) => attribute.toString()),
      salt: hexOf(credential.salt)
    },
    holderPublicKey: credential.holderPublicKey.toString(),
    registry:
      placement === undefined
        ? null
        : {
            generation: placement.generation,
            contractAddress: placement.contractAddress,
            leafIndex: placement.leafIndex.toString(),
            txId: placement.txId ?? null
          }
  }
}

function holderPublicKeyOf(body: unknown): bigint | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined
  }

  const keys = Object.keys(body)

  if (keys.length !== 1 || keys[0] !== "holderPublicKey" || !("holderPublicKey" in body)) {
    return undefined
  }

  return typeof body.holderPublicKey === "string" ? parseHolderPublicKey(body.holderPublicKey) : undefined
}

function registerCredentialRoutes(server: FastifyInstance, dependencies: CredentialRouteDependencies): void {
  dependencies.metrics.httpRequests.inc({ method: "POST", route: routeTemplate(collectionRoute), status: "202" }, 0)
  dependencies.metrics.httpRequests.inc({ method: "GET", route: routeTemplate(memberRoute), status: "200" }, 0)

  server.post(collectionRoute, { bodyLimit: requestBodyLimit }, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const holderPublicKey = holderPublicKeyOf(request.body)

    if (holderPublicKey === undefined) {
      return reply
        .code(400)
        .send(
          problem("INVALID_REQUEST", "the body must be { holderPublicKey }, a field element in decimal", request.id)
        )
    }

    const outcome = await dependencies.credentials.request(caller, holderPublicKey, dependencies.clock())

    switch (outcome.kind) {
      case "accepted":
        return reply
          .code(202)
          .header("Location", `${collectionRoute}/${outcome.credential.id}`)
          .send(viewOf({ credential: outcome.credential, standing: "pending", placement: undefined }))
      case "existing": {
        const status = await dependencies.credentials.status(caller, outcome.credential.id)

        if (status === undefined) {
          throw new Error(`credential ${outcome.credential.id} was found for its holder and then was not`)
        }

        return reply.code(200).header("Location", `${collectionRoute}/${outcome.credential.id}`).send(viewOf(status))
      }
      case "not_a_courier":
        return reply
          .code(403)
          .send(problem("COURIER_REQUIRED", "only a courier holds a courier credential", request.id))
      case "facts_stale":
        return reply
          .code(503)
          .header("Retry-After", String(factsRetryAfterSeconds))
          .send(
            problem("FACTS_UNAVAILABLE", "the delivery and review facts are not current; try again later", request.id)
          )
      case "no_deliveries":
        return reply
          .code(409)
          .send(problem("NO_DELIVERIES", "a credential needs at least one delivered order", request.id))
      case "issued_today":
        return reply
          .code(409)
          .send(problem("ISSUED_TODAY", "a credential was already issued today to another holder key", request.id))
    }
  })

  server.get<{ Params: { id: string } }>(memberRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const status = isLowercaseUuid(request.params.id)
      ? await dependencies.credentials.status(caller, request.params.id)
      : undefined

    if (status === undefined) {
      return reply.code(404).send(problem("NOT_FOUND", "no such credential", request.id))
    }

    return reply.code(200).send(viewOf(status))
  })
}

export { registerCredentialRoutes }
