import type { FactsConfig } from "./facts_config.type.ts"
import type { LogLevel } from "./log_level.type.ts"
import type { MeshConfig } from "./mesh_config.type.ts"
import type { ServiceMidnightEndpoints } from "./service_midnight_endpoints.type.ts"
import type { SponsorLinkConfig } from "./sponsor_link_config.type.ts"

type ServiceConfig = {
  serviceVersion: string
  httpPort: number
  logLevel: LogLevel
  databaseUrl: string
  blockfrostProjectId: string
  issuerSecret: Uint8Array
  midnight: ServiceMidnightEndpoints
  mesh: MeshConfig
  facts: FactsConfig
  sponsor: SponsorLinkConfig
  registryCheckSeconds: number
  midnightStepSeconds: number
  shutdownGraceSeconds: number
}

export type { ServiceConfig }
