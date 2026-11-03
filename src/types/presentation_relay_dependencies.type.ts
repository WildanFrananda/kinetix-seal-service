import type { PresentationInspectorPort } from "../application/ports/presentation_inspector.port.ts"
import type { PresentationMetricsPort } from "../application/ports/presentation_metrics.port.ts"
import type { RegistryGenerationStorePort } from "../application/ports/registry_generation_store.port.ts"
import type { TransactionPayerPort } from "../application/ports/transaction_payer.port.ts"

type PresentationRelayDependencies = {
  inspector: PresentationInspectorPort
  payer: TransactionPayerPort
  generations: RegistryGenerationStorePort
  metrics: PresentationMetricsPort
}

export type { PresentationRelayDependencies }
