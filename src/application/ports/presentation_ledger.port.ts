interface PresentationLedgerPort {
  presentations(contractAddress: string): Promise<Map<string, string>>
}

export type { PresentationLedgerPort }
