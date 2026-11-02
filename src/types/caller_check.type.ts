import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { TokenVerifierPort } from "../application/ports/token_verifier.port.ts"

type CallerCheck = {
  tokens: TokenVerifierPort
  logger: LoggerPort
}

export type { CallerCheck }
