import type { EstateMetrics } from "../../types/estate_metrics.type.ts"
import type { RouteMetricEntry } from "../../types/route_metric_entry.type.ts"
import { routeTemplate } from "./route_template.ts"

function seedRouteMetrics(metrics: EstateMetrics, entries: readonly RouteMetricEntry[]): void {
  for (const entry of entries) {
    metrics.httpRequests.inc({ method: entry.method, route: routeTemplate(entry.route), status: entry.status }, 0)
  }
}

export { seedRouteMetrics }
