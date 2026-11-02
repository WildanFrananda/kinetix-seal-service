import type { ZKConfigProvider } from "@midnight-ntwrk/midnight-js-types"

import type { SealTransactionDependencies } from "./seal_transaction_dependencies.type.ts"

type MidnightCredentialChainDependencies = SealTransactionDependencies & {
  zkConfig: ZKConfigProvider<string>
  issuerSecret: Uint8Array
}

export type { MidnightCredentialChainDependencies }
