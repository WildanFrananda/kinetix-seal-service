import type { PresentationLedgerPort } from "../../src/application/ports/presentation_ledger.port.ts"

class FakePresentationLedger implements PresentationLedgerPort {
  readonly answers = new Map<string, string>()
  readonly read: string[] = []
  fails: Error | undefined

  async presentations(contractAddress: string): Promise<Map<string, string>> {
    this.read.push(contractAddress)

    if (this.fails !== undefined) {
      throw this.fails
    }

    return new Map(this.answers)
  }
}

export default FakePresentationLedger
