import { Counter, Gauge, Histogram, type Registry } from "prom-client"

import type { EstateMetrics } from "../../types/estate_metrics.type.ts"

function estateMetrics(registry: Registry, service: string, version: string): EstateMetrics {
  const buildInfo = new Gauge({
    name: "kinetix_build_info",
    help: "Which build of the service is running",
    labelNames: ["service", "version"],
    registers: [registry]
  })

  buildInfo.set({ service, version }, 1)

  return {
    httpRequests: new Counter({
      name: "kinetix_http_requests_total",
      help: "HTTP requests answered, by method, route template and status",
      labelNames: ["method", "route", "status"],
      registers: [registry]
    }),
    httpDuration: new Histogram({
      name: "kinetix_http_request_duration_seconds",
      help: "Time to answer an HTTP request, by method and route template",
      labelNames: ["method", "route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry]
    })
  }
}

export { estateMetrics }
