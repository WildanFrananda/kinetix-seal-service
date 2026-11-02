import type { CredentialClass } from "../types/credential_class.type.ts"
import type { PredicateDraft } from "../types/predicate_draft.type.ts"

const longestLabel = 80
const longestFreshnessDays = 365
const unprintable = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u

function labelOf(text: string): string | undefined {
  const label = text.trim()
  const length = [...label].length

  if (length === 0 || length > longestLabel || unprintable.test(label)) {
    return undefined
  }

  return label
}

function withinThresholds(credentialClass: CredentialClass, minimums: readonly bigint[]): boolean {
  if (minimums.length !== credentialClass.thresholds.length) {
    return false
  }

  return credentialClass.thresholds.every((threshold, index) => {
    const minimum = minimums[index]

    return minimum !== undefined && minimum >= 0n && minimum <= threshold.maximum
  })
}

function draftPredicate(
  credentialClass: CredentialClass,
  text: string,
  minimums: readonly bigint[],
  freshnessDays: number
): PredicateDraft | undefined {
  const label = labelOf(text)

  if (label === undefined || !withinThresholds(credentialClass, minimums)) {
    return undefined
  }

  if (!Number.isInteger(freshnessDays) || freshnessDays < 1 || freshnessDays > longestFreshnessDays) {
    return undefined
  }

  return { classId: credentialClass.id, label, minimums: [...minimums], freshnessDays }
}

export { draftPredicate }
