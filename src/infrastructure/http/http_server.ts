import Fastify, { type FastifyInstance } from "fastify"

import type { HttpServerDependencies } from "../../types/http_server_dependencies.type.ts"
import { requestIdOf } from "./request_id.ts"
import { routeTemplate } from "./route_template.ts"

const routes = ["/health", "/health/ready", "/metrics"] as const

function buildHttpServer(dependencies: HttpServerDependencies): FastifyInstance {
  const server = Fastify({ logger: false, genReqId: (request) => requestIdOf(request.headers["x-request-id"]) })

  for (const route of routes) {
    dependencies.metrics.httpRequests.inc({ method: "GET", route, status: "200" }, 0)
  }

  server.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id)
  })

  server.addHook("onResponse", async (request, reply) => {
    const route = routeTemplate(request.routeOptions.url)
    const labels = { method: request.method, route }

    dependencies.metrics.httpRequests.inc({ ...labels, status: String(reply.statusCode) })
    dependencies.metrics.httpDuration.observe(labels, reply.elapsedTime / 1000)
  })

  server.setErrorHandler(async (error, request, reply) => {
    dependencies.logger.error({ message: "an HTTP request failed", requestId: request.id }, error)

    return reply.code(500).send({ status: "error", traceId: request.id })
  })

  server.get("/health", async () => {
    return { status: "ok", service: dependencies.service }
  })

  server.get("/health/ready", async (_request, reply) => {
    const report = await dependencies.readiness.report()

    return reply.code(report.ready ? 200 : 503).send({
      status: report.ready ? "ready" : "unavailable",
      database: report.database,
      sponsor: report.sponsor
    })
  })

  server.get("/metrics", async (request, reply) => {
    try {
      const body = await dependencies.registry.metrics()

      return reply
        .header("Content-Type", dependencies.registry.contentType)
        .header("Cache-Control", "no-store")
        .send(body)
    } catch (error) {
      dependencies.logger.error({ message: "the metrics could not be rendered", requestId: request.id }, error)

      return reply.code(503).header("Cache-Control", "no-store").send("metrics are unavailable")
    }
  })

  return server
}

export { buildHttpServer }
