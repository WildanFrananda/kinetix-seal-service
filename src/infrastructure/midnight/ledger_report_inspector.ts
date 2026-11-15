import {
  type AlignedValue,
  type Binding,
  type Proof,
  type SignatureEnabled,
  Transaction
} from "@midnight-ntwrk/midnight-js-protocol/v9"

import type { ReportInspectorPort } from "../../application/ports/report_inspector.port.ts"
import type { ExtractedReportFields } from "../../types/extracted_report_fields.type.ts"
import type { InspectedReportCall } from "../../types/inspected_report_call.type.ts"
import type { InspectedReportTransaction } from "../../types/inspected_report_transaction.type.ts"

function boundTransactionOf(bytes: Uint8Array): Transaction<SignatureEnabled, Proof, Binding> | undefined {
  try {
    return Transaction.deserialize<SignatureEnabled, Proof, Binding>("signature", "proof", "binding", bytes)
  } catch {
    return undefined
  }
}

function entryPointName(raw: string | Uint8Array): string {
  if (typeof raw === "string") {
    return raw
  }

  return new TextDecoder().decode(raw)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function paddedBytes(raw: Uint8Array, length: number): Uint8Array | undefined {
  if (raw.length > length) {
    return undefined
  }

  const out = new Uint8Array(length)

  out.set(raw)

  return out
}

function uint32FromLittleEndian(bytes: Uint8Array): bigint {
  return (
    BigInt(bytes[0] ?? 0) |
    (BigInt(bytes[1] ?? 0) << 8n) |
    (BigInt(bytes[2] ?? 0) << 16n) |
    (BigInt(bytes[3] ?? 0) << 24n)
  )
}

function alignedAtomLength(aligned: AlignedValue, index: number): number | undefined {
  const segment = aligned.alignment[index]

  if (segment?.tag !== "atom" || segment.value.tag !== "bytes") {
    return undefined
  }

  return segment.value.length
}

function isReportsWriteIdx(op: unknown): boolean {
  if (!isRecord(op) || !isRecord(op.idx)) {
    return false
  }

  if (op.idx.pushPath !== true || !Array.isArray(op.idx.path) || op.idx.path.length !== 1) {
    return false
  }

  const step = op.idx.path[0]

  if (!isRecord(step) || step.tag !== "value" || !isRecord(step.value)) {
    return false
  }

  const aligned = step.value as unknown as AlignedValue

  if (!Array.isArray(aligned.value) || aligned.value.length !== 1) {
    return false
  }

  if (alignedAtomLength(aligned, 0) !== 1) {
    return false
  }

  const slot = paddedBytes(aligned.value[0] as Uint8Array, 1)

  return slot !== undefined && slot[0] === 3
}

function pushCellContent(op: unknown, expectedStorage: boolean): AlignedValue | undefined {
  if (!isRecord(op) || !isRecord(op.push)) {
    return undefined
  }

  if (op.push.storage !== expectedStorage || !isRecord(op.push.value) || op.push.value.tag !== "cell") {
    return undefined
  }

  return op.push.value.content as AlignedValue | undefined
}

function isInsOp(op: unknown): boolean {
  return isRecord(op) && isRecord(op.ins) && op.ins.n === 1
}

function extractReportFields(program: unknown[]): ExtractedReportFields | undefined {
  let writeIdx = -1
  let writeCount = 0

  for (let index = 0; index < program.length; index += 1) {
    const op = program[index]

    if (isRecord(op) && isRecord(op.idx) && op.idx.pushPath === true) {
      writeCount += 1
      writeIdx = index
    }
  }

  if (writeCount !== 1 || writeIdx < 0 || writeIdx + 3 >= program.length) {
    return undefined
  }

  if (!isReportsWriteIdx(program[writeIdx]) || !isInsOp(program[writeIdx + 3])) {
    return undefined
  }

  const keyCell = pushCellContent(program[writeIdx + 1], false)
  const valueCell = pushCellContent(program[writeIdx + 2], true)

  if (keyCell === undefined || valueCell === undefined) {
    return undefined
  }

  if (keyCell.value.length !== 1 || alignedAtomLength(keyCell, 0) !== 32) {
    return undefined
  }

  if (
    valueCell.value.length !== 3 ||
    alignedAtomLength(valueCell, 0) !== 32 ||
    alignedAtomLength(valueCell, 1) !== 4 ||
    alignedAtomLength(valueCell, 2) !== 32
  ) {
    return undefined
  }

  const nullifier = paddedBytes(keyCell.value[0] as Uint8Array, 32)
  const merchantTag = paddedBytes(valueCell.value[0] as Uint8Array, 32)
  const windowBytes = paddedBytes(valueCell.value[1] as Uint8Array, 4)
  const digest = paddedBytes(valueCell.value[2] as Uint8Array, 32)

  if (nullifier === undefined || merchantTag === undefined || windowBytes === undefined || digest === undefined) {
    return undefined
  }

  return {
    nullifier,
    merchantTag,
    window: uint32FromLittleEndian(windowBytes),
    digest
  }
}

class LedgerReportInspector implements ReportInspectorPort {
  inspect(bytes: Uint8Array): InspectedReportTransaction | undefined {
    const transaction = boundTransactionOf(bytes)

    if (transaction === undefined || transaction.rewards !== undefined) {
      return undefined
    }

    const calls: InspectedReportCall[] = []
    let otherActions = 0

    for (const intent of transaction.intents?.values() ?? []) {
      for (const action of intent.actions) {
        if ("entryPoint" in action) {
          const entryPoint = entryPointName(action.entryPoint)
          const program = action.guaranteedTranscript?.program
          const extracted =
            entryPoint === "report" && action.fallibleTranscript === undefined && Array.isArray(program)
              ? extractReportFields(program)
              : undefined

          if (extracted === undefined) {
            otherActions += 1
          } else {
            calls.push({
              address: String(action.address),
              entryPoint,
              nullifier: extracted.nullifier,
              merchantTag: extracted.merchantTag,
              window: extracted.window,
              digest: extracted.digest
            })
          }
        } else {
          otherActions += 1
        }
      }
    }

    const offers = (transaction.guaranteedOffer === undefined ? 0 : 1) + (transaction.fallibleOffer?.size ?? 0)

    return { calls, otherActions, offers }
  }
}

export default LedgerReportInspector
