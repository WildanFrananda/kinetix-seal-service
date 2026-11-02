import type { FastifyReply, FastifyRequest } from "fastify"

import type { CallerCheck } from "../../types/caller_check.type.ts"
import type { CallerPrincipal } from "../../types/caller_principal.type.ts"
import { problem } from "./problem.ts"

async function callerOf(
  check: CallerCheck,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CallerPrincipal | undefined> {
  const verdict = await check.tokens.verify(request.headers.authorization)

  if (verdict.kind === "principal") {
    return verdict.principal
  }

  if (verdict.kind === "unavailable") {
    check.logger.warn({
      message: "identity's signing keys could not be read",
      requestId: request.id,
      fields: { cause: verdict.reason }
    })

    await reply.code(503).send(problem("IDENTITY_UNAVAILABLE", "the token cannot be checked now", request.id))

    return undefined
  }

  await reply
    .code(401)
    .header("WWW-Authenticate", "Bearer")
    .send(problem("TOKEN_REFUSED", "a valid access token is required", request.id))

  return undefined
}

export { callerOf }
