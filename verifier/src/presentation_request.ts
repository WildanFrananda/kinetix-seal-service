import type { PresentationRequest } from "../types/presentation_request.type.ts"

function requestCode(request: PresentationRequest): string {
  const query = [
    "v=1",
    `r=${request.contractAddress}`,
    `p=${request.predicateId}`,
    `c=${request.challenge}`,
    `a=${encodeURIComponent(request.answerUrl)}`
  ].join("&")

  return `kinetix-seal:present?${query}`
}

export { requestCode }
