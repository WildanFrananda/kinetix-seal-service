import type { ProofProvider } from "@midnight-ntwrk/midnight-js-types"
import { SucceedEntirely } from "@midnight-ntwrk/midnight-js-types"

import type { ConfirmedTransaction } from "../../types/confirmed_transaction.type.ts"
import type { SealTransactionDependencies } from "../../types/seal_transaction_dependencies.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"

async function submitSealTransaction(
  dependencies: SealTransactionDependencies,
  transaction: Parameters<ProofProvider["proveTx"]>[0],
  what: string
): Promise<ConfirmedTransaction> {
  const { payer, proofs, publicData, networkStepSeconds } = dependencies
  const proven = await withTimeout(proofs.proveTx(transaction), networkStepSeconds, `proving ${what}`)
  const txId = await withTimeout(payer.pay(proven.serialize()), networkStepSeconds, `paying for ${what}`)
  const data = await withTimeout(publicData.watchForTxData(txId), networkStepSeconds, `confirming ${what}`)

  if (data.status !== SucceedEntirely) {
    throw new Error(`${what} finished ${data.status} (tx ${txId})`)
  }

  return { txId, blockHeight: data.blockHeight, blockHash: data.blockHash }
}

export { submitSealTransaction }
