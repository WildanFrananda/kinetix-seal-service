import type { TransactionPayerPort } from "../../src/application/ports/transaction_payer.port.ts"

class RecordingTransactionPayer implements TransactionPayerPort {
  readonly paid: Uint8Array[] = []
  readonly sponsored: Uint8Array[] = []
  failure: Error | undefined

  async pay(unboundTransaction: Uint8Array): Promise<string> {
    if (this.failure !== undefined) {
      throw this.failure
    }

    this.paid.push(unboundTransaction)

    return `00tx${this.paid.length}`
  }

  async sponsor(boundTransaction: Uint8Array): Promise<string> {
    if (this.failure !== undefined) {
      throw this.failure
    }

    this.sponsored.push(boundTransaction)

    return `00sp${this.sponsored.length}`
  }
}

export default RecordingTransactionPayer
