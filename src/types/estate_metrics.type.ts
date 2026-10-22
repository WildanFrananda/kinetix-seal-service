import type { Counter, Histogram } from "prom-client"

type EstateMetrics = {
  httpRequests: Counter<"method" | "route" | "status">
  httpDuration: Histogram<"method" | "route">
}

export type { EstateMetrics }
