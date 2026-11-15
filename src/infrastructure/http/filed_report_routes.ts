import type { FastifyInstance, FastifyRequest } from "fastify"

import type { FiledReportRouteDependencies } from "../../types/filed_report_route_dependencies.type.ts"
import type { SubmitReportInput } from "../../types/submit_report_input.type.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const categoriesRoute = "/api/v1/seal/report-categories"
const reportsRoute = "/api/v1/seal/reports"
const reportStatusRoute = "/api/v1/seal/reports/:nullifier"
const requestBodyLimit = 32_768
const sponsorRetryAfterSeconds = 30
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function decodeBase64(encoded: string): Uint8Array | undefined {
  if (encoded.length === 0 || encoded.length % 4 !== 0 || !base64Pattern.test(encoded)) {
    return undefined
  }

  return new Uint8Array(Buffer.from(encoded, "base64"))
}

function clientAddressOf(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"]
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded

  if (typeof raw === "string") {
    const first = raw.split(",")[0]?.trim()

    if (first !== undefined && first.length > 0) {
      return first
    }
  }

  return request.ip || request.socket.remoteAddress || "unknown"
}

function parsedSubmission(body: unknown): SubmitReportInput | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined
  }

  const transactionEncoded: unknown = Reflect.get(body, "transaction")
  const category: unknown = Reflect.get(body, "category")
  const text: unknown = Reflect.get(body, "body")
  const salt: unknown = Reflect.get(body, "salt")

  if (
    typeof transactionEncoded !== "string" ||
    typeof category !== "string" ||
    typeof text !== "string" ||
    typeof salt !== "string"
  ) {
    return undefined
  }

  const transaction = decodeBase64(transactionEncoded)

  if (transaction === undefined || transaction.length === 0) {
    return undefined
  }

  return {
    transaction,
    category,
    body: text,
    salt
  }
}

function registerFiledReportRoutes(server: FastifyInstance, dependencies: FiledReportRouteDependencies): void {
  dependencies.metrics.httpRequests.inc({ method: "GET", route: routeTemplate(categoriesRoute), status: "200" }, 0)
  dependencies.metrics.httpRequests.inc({ method: "POST", route: routeTemplate(reportsRoute), status: "202" }, 0)
  dependencies.metrics.httpRequests.inc({ method: "GET", route: routeTemplate(reportStatusRoute), status: "200" }, 0)

  server.get(categoriesRoute, async (_request, reply) => {
    reply.header("Cache-Control", "no-store")

    const categories = await dependencies.submissions.activeCategories()

    return reply.code(200).send({ categories })
  })

  server.post(reportsRoute, { bodyLimit: requestBodyLimit }, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    if (!dependencies.rateLimiter.allow(clientAddressOf(request))) {
      dependencies.reportMetrics.reportSubmitted("rate_limited")

      return reply.code(429).send(problem("RATE_LIMITED", "too many report submissions from this address", request.id))
    }

    const input = parsedSubmission(request.body)

    if (input === undefined) {
      return reply
        .code(400)
        .send(problem("INVALID_REQUEST", "a base64 transaction, category, body, and salt are required", request.id))
    }

    const outcome = await dependencies.submissions.submit(input)

    switch (outcome.kind) {
      case "accepted":
        return reply.code(202).send({
          nullifier: outcome.nullifier,
          txId: outcome.txId,
          status: outcome.status
        })
      case "unknown_category":
        return reply.code(400).send(problem("UNKNOWN_CATEGORY", "report category is unknown or inactive", request.id))
      case "invalid_body":
        return reply
          .code(400)
          .send(problem("INVALID_REQUEST", "report body must be non-empty and within 4000 characters", request.id))
      case "invalid_salt":
        return reply.code(400).send(problem("INVALID_REQUEST", "salt must be 32 bytes in hex", request.id))
      case "digest_mismatch":
        return reply
          .code(422)
          .send(problem("DIGEST_MISMATCH", "transaction digest does not match category, body, and salt", request.id))
      case "not_a_report":
        return reply
          .code(422)
          .send(problem("NOT_A_REPORT", "transaction is not a bound report for the active report registry", request.id))
      case "already_reported":
        return reply.code(409).send(problem("ALREADY_REPORTED", "this report right has already been used", request.id))
      case "crowd_too_small":
        return reply
          .code(409)
          .send(
            problem(
              "CROWD_TOO_SMALL",
              "fewer holders exist in this merchant window than the anonymity threshold requires",
              request.id
            )
          )
      case "registry_unavailable":
        return reply
          .code(503)
          .header("Retry-After", String(sponsorRetryAfterSeconds))
          .send(problem("REGISTRY_UNAVAILABLE", "the report registry is not ready", request.id))
      case "sponsor_unavailable":
        return reply
          .code(503)
          .header("Retry-After", String(sponsorRetryAfterSeconds))
          .send(problem("SPONSOR_UNAVAILABLE", "the sponsor wallet could not submit the transaction", request.id))
    }
  })

  server.get<{ Params: { nullifier: string } }>(reportStatusRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const found = await dependencies.submissions.statusOf(request.params.nullifier)

    if (found === undefined) {
      return reply.code(404).send(problem("REPORT_NOT_FOUND", "no report with that nullifier was found", request.id))
    }

    return reply.code(200).send({
      nullifier: found.nullifier,
      status: found.status,
      generation: found.generation,
      txId: found.txId,
      submittedAt: found.submittedAt.toISOString(),
      confirmedAt: found.confirmedAt?.toISOString()
    })
  })
}

export { registerFiledReportRoutes }
