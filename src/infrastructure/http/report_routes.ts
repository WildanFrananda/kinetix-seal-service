import type { FastifyInstance } from "fastify"

import { hexOf } from "../../domain/hex.ts"
import { reportOrderOf } from "../../domain/report_order.ts"
import { parseReporterKey } from "../../domain/reporter_key.ts"
import type { HeldRight } from "../../types/held_right.type.ts"
import type { HeldRightView } from "../../types/held_right_view.type.ts"
import type { ReportRouteDependencies } from "../../types/report_route_dependencies.type.ts"
import type { ReporterRecord } from "../../types/reporter_record.type.ts"
import type { ReporterView } from "../../types/reporter_view.type.ts"
import { callerOf } from "./caller_of.ts"
import { problem } from "./problem.ts"
import { seedRouteMetrics } from "./seed_route_metrics.ts"
import { singleStringField } from "./single_string_field.ts"

const reportersRoute = "/api/v1/seal/reporters"
const rightsRoute = "/api/v1/seal/report-rights"
const requestBodyLimit = 1024

function reporterViewOf(reporter: ReporterRecord): ReporterView {
  return {
    id: reporter.id,
    role: reporter.role,
    reporterKey: reporter.reporterKey.toString(),
    registeredAt: reporter.registeredAt.toISOString()
  }
}

function rightViewOf(right: HeldRight): HeldRightView {
  return {
    id: right.id,
    role: right.role,
    orderNumber: right.orderNumber,
    order: hexOf(reportOrderOf(right.orderNumber)),
    reporterKey: right.reporterKey.toString(),
    merchantTag: hexOf(right.merchantTag),
    window: right.window,
    deliveredAt: right.deliveredAt.toISOString(),
    status: right.leafIndex === undefined ? "pending" : "granted",
    leafIndex: right.leafIndex === undefined ? null : right.leafIndex.toString(),
    crowd: right.crowd
  }
}

function reporterKeyOf(body: unknown): bigint | undefined {
  const value = singleStringField(body, "reporterKey")

  return value === undefined ? undefined : parseReporterKey(value)
}

function registerReportRoutes(server: FastifyInstance, dependencies: ReportRouteDependencies): void {
  seedRouteMetrics(dependencies.metrics, [
    { method: "POST", route: reportersRoute, status: "201" },
    { method: "GET", route: rightsRoute, status: "200" }
  ])

  server.post(reportersRoute, { bodyLimit: requestBodyLimit }, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const reporterKey = reporterKeyOf(request.body)

    if (reporterKey === undefined) {
      return reply
        .code(400)
        .send(problem("INVALID_REQUEST", "the body must be { reporterKey }, a field element in decimal", request.id))
    }

    const outcome = await dependencies.reporters.register(caller, reporterKey, dependencies.clock())

    switch (outcome.kind) {
      case "registered":
        return reply.code(201).send(reporterViewOf(outcome.reporter))
      case "existing":
        return reply.code(200).send(reporterViewOf(outcome.reporter))
      case "not_a_reporter":
        return reply
          .code(403)
          .send(problem("REPORTER_ROLE_REQUIRED", "only a buyer or a courier reports a merchant", request.id))
      case "key_taken":
        return reply
          .code(409)
          .send(problem("REPORTER_KEY_TAKEN", "that reporter key is registered to another account", request.id))
    }
  })

  server.get(rightsRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const held = await dependencies.rights.heldBy(caller)

    return reply.code(200).send({
      registry:
        held.registry === undefined
          ? null
          : { generation: held.registry.generation, contractAddress: held.registry.contractAddress },
      rights: held.rights.map(rightViewOf)
    })
  })
}

export { registerReportRoutes }
