import type { ReporterRecord } from "./reporter_record.type.ts"

type ReporterRegistrationOutcome =
  | { kind: "registered"; reporter: ReporterRecord }
  | { kind: "existing"; reporter: ReporterRecord }
  | { kind: "not_a_reporter" }
  | { kind: "key_taken" }

export type { ReporterRegistrationOutcome }
