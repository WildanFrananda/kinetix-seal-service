import type CourierCredentials from "../application/courier_credentials.service.ts"
import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { TokenVerifierPort } from "../application/ports/token_verifier.port.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type CredentialRouteDependencies = {
  credentials: CourierCredentials
  tokens: TokenVerifierPort
  logger: LoggerPort
  metrics: EstateMetrics
  clock: () => Date
}

export type { CredentialRouteDependencies }
