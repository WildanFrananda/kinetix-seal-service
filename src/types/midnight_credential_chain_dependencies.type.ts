import type { MidnightConfig, ZKConfigProvider } from "@midnight-ntwrk/midnight-js-types"

import type { SealTransactionDependencies } from "./seal_transaction_dependencies.type.ts"

type MidnightCredentialChainDependencies = SealTransactionDependencies & {
  zkConfig: ZKConfigProvider<string>
  issuerSecret: Uint8Array
  config: MidnightConfig
}

export type { MidnightCredentialChainDependencies }
