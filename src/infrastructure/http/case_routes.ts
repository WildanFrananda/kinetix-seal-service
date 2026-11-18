import type { FastifyInstance } from "fastify"

import type { CaseDetail } from "../../types/case_detail.type.ts"
import type { CaseReport } from "../../types/case_report.type.ts"
import type { CaseRouteDependencies } from "../../types/case_route_dependencies.type.ts"
import type { CaseStatusFilter } from "../../types/case_status_filter.type.ts"
import type { CaseSummary } from "../../types/case_summary.type.ts"
import { callerOf } from "./caller_of.ts"
import { problem } from "./problem.ts"
import { seedRouteMetrics } from "./seed_route_metrics.ts"

const collectionRoute = "/api/v1/seal/cases"
const memberRoute = "/api/v1/seal/cases/:merchantId"

const validStatuses: readonly CaseStatusFilter[] = ["all", "confirmed", "submitted"]

function statusFilterOf(raw: unknown): CaseStatusFilter | undefined {
  if (raw === undefined || raw === "") {
    return "all"
  }

  if (typeof raw !== "string") {
    return undefined
  }

  return validStatuses.find((candidate) => candidate === raw)
}

function summaryViewOf(summary: CaseSummary) {
  return {
    merchantPrincipalId: summary.merchantPrincipalId,
    merchantTag: summary.merchantTag,
    merchant: summary.merchant,
    confirmedCount: summary.confirmedCount,
    pendingCount: summary.pendingCount,
    totalCount: summary.totalCount,
    windowCount: summary.windowCount,
    earliestWindow: summary.earliestWindow,
    latestWindow: summary.latestWindow,
    firstReportedAt: summary.firstReportedAt.toISOString(),
    latestReportedAt: summary.latestReportedAt.toISOString(),
    categories: summary.categories
  }
}

function reportViewOf(report: CaseReport) {
  return {
    nullifier: report.nullifier,
    category: report.category,
    body: report.body,
    window: report.window,
    status: report.status,
    firstGeneration: report.firstGeneration,
    txId: report.txId ?? null,
    submittedAt: report.submittedAt.toISOString(),
    confirmedAt: report.confirmedAt?.toISOString() ?? null
  }
}

function detailViewOf(detail: CaseDetail) {
  return {
    ...summaryViewOf(detail),
    reports: detail.reports.map(reportViewOf)
  }
}

function registerCaseRoutes(server: FastifyInstance, dependencies: CaseRouteDependencies): void {
  const { cases, metrics } = dependencies

  seedRouteMetrics(metrics, [
    { method: "GET", route: collectionRoute, status: "200" },
    { method: "GET", route: memberRoute, status: "200" }
  ])

  server.get<{ Querystring: { status?: unknown } }>(collectionRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const statusFilter = statusFilterOf(request.query.status)

    if (statusFilter === undefined) {
      return reply
        .code(400)
        .send(problem("INVALID_REQUEST", "status must be one of all, confirmed, submitted", request.id))
    }

    const outcome = await cases.list(caller, statusFilter)

    if (outcome.kind === "not_admin") {
      return reply.code(403).send(problem("ADMIN_REQUIRED", "only an admin inspects cases", request.id))
    }

    return reply.code(200).send({
      cases: outcome.cases.map(summaryViewOf)
    })
  })

  server.get<{ Params: { merchantId: string }; Querystring: { status?: unknown } }>(
    memberRoute,
    async (request, reply) => {
      reply.header("Cache-Control", "no-store")

      const caller = await callerOf(dependencies, request, reply)

      if (caller === undefined) {
        return reply
      }

      const statusFilter = statusFilterOf(request.query.status)

      if (statusFilter === undefined) {
        return reply
          .code(400)
          .send(problem("INVALID_REQUEST", "status must be one of all, confirmed, submitted", request.id))
      }

      const { merchantId } = request.params

      if (merchantId === "" || [...merchantId].length > 128) {
        return reply.code(404).send(problem("CASE_NOT_FOUND", "no reports for that merchant", request.id))
      }

      const outcome = await cases.detail(caller, merchantId, statusFilter)

      if (outcome.kind === "not_admin") {
        return reply.code(403).send(problem("ADMIN_REQUIRED", "only an admin inspects cases", request.id))
      }

      if (outcome.kind === "not_found") {
        return reply.code(404).send(problem("CASE_NOT_FOUND", "no reports for that merchant", request.id))
      }

      return reply.code(200).send(detailViewOf(outcome.detail))
    }
  )
}

export { registerCaseRoutes }
