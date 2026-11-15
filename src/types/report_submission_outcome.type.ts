type ReportSubmissionOutcome =
  | { kind: "accepted"; nullifier: string; txId: string; status: "submitted" }
  | { kind: "unknown_category" }
  | { kind: "invalid_body" }
  | { kind: "invalid_salt" }
  | { kind: "digest_mismatch" }
  | { kind: "registry_unavailable" }
  | { kind: "not_a_report" }
  | { kind: "already_reported" }
  | { kind: "crowd_too_small"; holders: number; minimum: number }
  | { kind: "sponsor_unavailable" }

export type { ReportSubmissionOutcome }
