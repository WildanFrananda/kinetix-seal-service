import type { EstateMetrics } from "../../types/estate_metrics.type.ts"
import { routeTemplate } from "./route_template.ts"

function seedRouteMetrics(
  metrics: EstateMetrics,
  entries: readonly { method: string; route: string; status: string }[]
): void {
  for (const entry of entries) {
    metrics.httpRequests.inc({ method: entry.method, route: routeTemplate(entry.route), status: entry.status }, 0)
  }
}

export { seedRouteMetrics }
