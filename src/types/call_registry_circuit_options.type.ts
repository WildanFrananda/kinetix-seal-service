import type { MidnightCredentialChainDependencies } from "./midnight_credential_chain_dependencies.type.ts"

type CallRegistryCircuitOptions<K extends string> = {
  dependencies: MidnightCredentialChainDependencies
  compiledContract: unknown
  contractAddress: string
  circuitId: K
  args: readonly unknown[]
  label: string
  what: string
}

export type { CallRegistryCircuitOptions }
