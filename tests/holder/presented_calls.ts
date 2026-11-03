import {
  type Binding,
  type Proof,
  type SignatureEnabled,
  Transaction
} from "@midnight-ntwrk/midnight-js-protocol/ledger"

function presentedCalls(transactionHex: string): Array<{ address: string; entryPoint: string }> {
  const transaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    "signature",
    "proof",
    "binding",
    Buffer.from(transactionHex, "hex")
  )

  const calls: Array<{ address: string; entryPoint: string }> = []

  for (const intent of transaction.intents?.values() ?? []) {
    for (const action of intent.actions) {
      if ("entryPoint" in action) {
        calls.push({
          address: String(action.address),
          entryPoint:
            typeof action.entryPoint === "string" ? action.entryPoint : new TextDecoder().decode(action.entryPoint)
        })
      }
    }
  }

  return calls
}

export { presentedCalls }
