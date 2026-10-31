import type { LogLevel } from "./log_level.type.ts"
import type { MeshConfig } from "./mesh_config.type.ts"
import type { MidnightEndpoints } from "./midnight_endpoints.type.ts"
import type { SponsorThresholds } from "./sponsor_thresholds.type.ts"

type SponsorConfig = {
  serviceVersion: string
  httpPort: number
  apiPort: number
  logLevel: LogLevel
  databaseUrl: string
  blockfrostProjectId: string
  sponsorMnemonic: string
  midnight: MidnightEndpoints
  mesh: MeshConfig
  walletStateDir: string
  sponsorMonitorSeconds: number
  walletCheckpointSeconds: number
  shutdownGraceSeconds: number
  sponsorThresholds: SponsorThresholds
}

export type { SponsorConfig }
