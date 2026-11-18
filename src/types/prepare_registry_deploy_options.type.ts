import type { MidnightRegistryChainDependencies } from "./midnight_registry_chain_dependencies.type.ts"
import type { RegistryKind } from "./registry_kind.type.ts"

type PrepareRegistryDeployOptions = {
  dependencies: MidnightRegistryChainDependencies
  compiledContract: unknown
  kind: RegistryKind
  generation: number
  issuerPublicKey: (secret: Uint8Array) => unknown
  what: string
}

export type { PrepareRegistryDeployOptions }
