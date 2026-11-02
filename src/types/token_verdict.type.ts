import type { CallerPrincipal } from "./caller_principal.type.ts"

type TokenVerdict =
  | { kind: "principal"; principal: CallerPrincipal }
  | { kind: "refused"; reason: string }
  | { kind: "unavailable"; reason: string }

export type { TokenVerdict }
