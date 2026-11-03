import type BundleAssets from "../infrastructure/http/bundle_assets.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type VerifierRouteDependencies = {
  assets: BundleAssets
  metrics: EstateMetrics
}

export type { VerifierRouteDependencies }
