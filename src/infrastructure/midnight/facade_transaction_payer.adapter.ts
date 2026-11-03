import {
  type Binding,
  type PreBinding,
  type Proof,
  type SignatureEnabled,
  Transaction
} from "@midnight-ntwrk/midnight-js-protocol/ledger"
import type { WalletFacade } from "@midnightntwrk/wallet-sdk"

import type { TransactionPayerPort } from "../../application/ports/transaction_payer.port.ts"
import type { WalletKeys } from "../../types/wallet_keys.type.ts"
import { payAndSubmit, sponsorAndSubmit } from "./wallet_transactions.ts"

class FacadeTransactionPayer implements TransactionPayerPort {
  private readonly wallet: WalletFacade
  private readonly keys: WalletKeys
  private queue: Promise<unknown> = Promise.resolve()

  constructor(wallet: WalletFacade, keys: WalletKeys) {
    this.wallet = wallet
    this.keys = keys
  }

  pay(unboundTransaction: Uint8Array): Promise<string> {
    return this.inTurn(() => this.payNow(unboundTransaction))
  }

  sponsor(boundTransaction: Uint8Array): Promise<string> {
    return this.inTurn(() => this.sponsorNow(boundTransaction))
  }

  private inTurn(spend: () => Promise<string>): Promise<string> {
    const turn = this.queue.then(spend)

    this.queue = turn.catch(() => undefined)

    return turn
  }

  private async payNow(unboundTransaction: Uint8Array): Promise<string> {
    const transaction = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      "signature",
      "proof",
      "pre-binding",
      unboundTransaction
    )

    return payAndSubmit(this.wallet, this.keys, transaction)
  }

  private async sponsorNow(boundTransaction: Uint8Array): Promise<string> {
    const transaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      "signature",
      "proof",
      "binding",
      boundTransaction
    )

    return sponsorAndSubmit(this.wallet, this.keys, transaction)
  }
}

export default FacadeTransactionPayer
