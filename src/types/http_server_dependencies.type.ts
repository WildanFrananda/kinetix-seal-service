import type { Registry } from "prom-client"

import type { LoggerPort } from "../application/ports/logger.port.ts"
import type Readiness from "../application/readiness.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type HttpServerDependencies = {
  service: string
  readiness: Readiness
  registry: Registry
  metrics: EstateMetrics
  logger: LoggerPort
}

export type { HttpServerDependencies }
