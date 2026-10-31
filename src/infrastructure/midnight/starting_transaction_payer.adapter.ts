import type { TransactionPayerPort } from "../../application/ports/transaction_payer.port.ts"
import SponsorUnavailable from "../../domain/sponsor_unavailable.ts"

class StartingTransactionPayer implements TransactionPayerPort {
  private delegate: TransactionPayerPort | undefined

  started(payer: TransactionPayerPort): void {
    this.delegate = payer
  }

  async pay(unboundTransaction: Uint8Array): Promise<string> {
    if (this.delegate === undefined) {
      throw new SponsorUnavailable("the sponsor wallet has not started")
    }

    return this.delegate.pay(unboundTransaction)
  }
}

export default StartingTransactionPayer
