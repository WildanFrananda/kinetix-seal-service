import type { UnshieldedKeystore, WalletFacade } from "@midnightntwrk/wallet-sdk"

import type { TransactionPayerPort } from "../../application/ports/transaction_payer.port.ts"
import { payAndSubmit, sponsorAndSubmit } from "./wallet_transactions.ts"

class FacadeTransactionPayer implements TransactionPayerPort {
  private readonly wallet: WalletFacade
  private readonly keystore: UnshieldedKeystore
  private queue: Promise<unknown> = Promise.resolve()

  constructor(wallet: WalletFacade, keystore: UnshieldedKeystore) {
    this.wallet = wallet
    this.keystore = keystore
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
    return payAndSubmit(this.wallet, this.keystore, this.wallet.adoptTransaction(unboundTransaction, "Unbound"))
  }

  private async sponsorNow(boundTransaction: Uint8Array): Promise<string> {
    return sponsorAndSubmit(this.wallet, this.keystore, this.wallet.adoptTransaction(boundTransaction, "Finalized"))
  }
}

export default FacadeTransactionPayer
