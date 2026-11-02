import type { ProblemBody } from "../../types/problem_body.type.ts"

function problem(error: string, message: string, traceId: string): ProblemBody {
  return { error, message, traceId }
}

export { problem }
