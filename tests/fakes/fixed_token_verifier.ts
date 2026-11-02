import type { TokenVerifierPort } from "../../src/application/ports/token_verifier.port.ts"
import type { TokenVerdict } from "../../src/types/token_verdict.type.ts"

class FixedTokenVerifier implements TokenVerifierPort {
  readonly verdicts = new Map<string, TokenVerdict>()
  readonly unknown: TokenVerdict = { kind: "refused", reason: "unknown token" }

  async verify(authorization: string | undefined): Promise<TokenVerdict> {
    return this.verdicts.get(authorization ?? "") ?? this.unknown
  }
}

export default FixedTokenVerifier
