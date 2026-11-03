import type HolderAssets from "../infrastructure/http/holder_assets.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type HolderRouteDependencies = {
  assets: HolderAssets
  metrics: EstateMetrics
}

export type { HolderRouteDependencies }
