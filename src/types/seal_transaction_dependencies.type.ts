import type { ProofProvider, PublicDataProvider } from "@midnight-ntwrk/midnight-js-types"

import type { TransactionPayerPort } from "../application/ports/transaction_payer.port.ts"

type SealTransactionDependencies = {
  payer: TransactionPayerPort
  publicData: PublicDataProvider
  proofs: ProofProvider
  networkStepSeconds: number
}

export type { SealTransactionDependencies }
