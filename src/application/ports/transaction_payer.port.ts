interface TransactionPayerPort {
  pay(unboundTransaction: Uint8Array): Promise<string>
}

export type { TransactionPayerPort }
