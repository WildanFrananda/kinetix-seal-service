import type { TokenVerdict } from "../../types/token_verdict.type.ts"

interface TokenVerifierPort {
  verify(authorization: string | undefined): Promise<TokenVerdict>
}

export type { TokenVerifierPort }
