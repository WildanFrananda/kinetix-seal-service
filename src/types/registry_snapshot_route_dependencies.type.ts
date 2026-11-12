import type { LoggerPort } from "../application/ports/logger.port.ts"
import type RegistrySnapshots from "../application/registry_snapshots.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type RegistrySnapshotRouteDependencies = {
  route: string
  snapshots: RegistrySnapshots
  logger: LoggerPort
  metrics: EstateMetrics
}

export type { RegistrySnapshotRouteDependencies }
