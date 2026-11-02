import { createRemoteJWKSet, errors, jwtVerify } from "jose"

import type { TokenVerifierPort } from "../../application/ports/token_verifier.port.ts"
import type { IdentityTokenConfig } from "../../types/identity_token_config.type.ts"
import type { TokenVerdict } from "../../types/token_verdict.type.ts"
import { bearerTokenOf } from "./bearer_token.ts"

const clockToleranceSeconds = 30
const unknownKeyRefetchMilliseconds = 10_000
const keySetLifetimeMilliseconds = 600_000

function keysUnreachable(error: unknown): boolean {
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid) {
    return true
  }

  if (error instanceof errors.JOSEError) {
    return error.code === "ERR_JOSE_GENERIC"
  }

  return true
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

class JoseTokenVerifier implements TokenVerifierPort {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>
  private readonly config: IdentityTokenConfig

  constructor(config: IdentityTokenConfig) {
    this.config = config
    this.keys = createRemoteJWKSet(new URL(config.jwksUrl), {
      timeoutDuration: config.timeoutSeconds * 1000,
      cooldownDuration: unknownKeyRefetchMilliseconds,
      cacheMaxAge: keySetLifetimeMilliseconds
    })
  }

  async verify(authorization: string | undefined): Promise<TokenVerdict> {
    const token = bearerTokenOf(authorization)

    if (token === undefined) {
      return { kind: "refused", reason: "a bearer token is required" }
    }

    try {
      const { payload } = await jwtVerify(token, this.keys, {
        algorithms: ["RS256"],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: clockToleranceSeconds,
        requiredClaims: ["sub", "exp", "iat"]
      })

      if (payload.token_use !== "access") {
        return { kind: "refused", reason: "the token is not an access token" }
      }

      if (typeof payload.sub !== "string" || payload.sub === "") {
        return { kind: "refused", reason: "the token names no principal" }
      }

      if (typeof payload.role !== "string" || payload.role === "") {
        return { kind: "refused", reason: "the token names no role" }
      }

      return { kind: "principal", principal: { principalId: payload.sub, role: payload.role } }
    } catch (error) {
      if (keysUnreachable(error)) {
        return { kind: "unavailable", reason: describe(error) }
      }

      return { kind: "refused", reason: describe(error) }
    }
  }
}

export default JoseTokenVerifier
