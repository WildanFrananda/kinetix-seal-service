import type { FactsConfig } from "./facts_config.type.ts"
import type { LogLevel } from "./log_level.type.ts"
import type { MeshConfig } from "./mesh_config.type.ts"
import type { MidnightEndpoints } from "./midnight_endpoints.type.ts"
import type { SponsorThresholds } from "./sponsor_thresholds.type.ts"

type SealConfig = {
  serviceVersion: string
  httpPort: number
  logLevel: LogLevel
  databaseUrl: string
  blockfrostProjectId: string
  sponsorMnemonic: string
  issuerSecret: Uint8Array
  midnight: MidnightEndpoints
  mesh: MeshConfig
  facts: FactsConfig
  walletStateDir: string
  sponsorMonitorSeconds: number
  walletCheckpointSeconds: number
  registryCheckSeconds: number
  midnightStepSeconds: number
  shutdownGraceSeconds: number
  sponsorThresholds: SponsorThresholds
}

export type { SealConfig }
