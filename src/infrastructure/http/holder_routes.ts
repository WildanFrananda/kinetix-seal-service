import type { FastifyInstance } from "fastify"

import type { HolderRouteDependencies } from "../../types/holder_route_dependencies.type.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const holderRoute = "/api/v1/seal/holder"
const holderFileRoute = "/api/v1/seal/holder/:digest/:file"
const pagePolicy = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ")

function registerHolderRoutes(server: FastifyInstance, dependencies: HolderRouteDependencies): void {
  const { assets, metrics } = dependencies

  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(holderRoute), status: "200" }, 0)
  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(holderFileRoute), status: "200" }, 0)

  server.get(holderRoute, async (_request, reply) => {
    return reply
      .code(200)
      .header("Cache-Control", "no-cache")
      .send({
        digest: assets.digest,
        entry: `${holderRoute}/${assets.digest}/index.html`,
        notices: `${holderRoute}/${assets.digest}/THIRD_PARTY_NOTICES.txt`
      })
  })

  server.get<{ Params: { digest: string; file: string } }>(holderFileRoute, async (request, reply) => {
    const asset = assets.file(request.params.digest, request.params.file)

    if (asset === undefined) {
      return reply
        .code(404)
        .header("Cache-Control", "no-store")
        .send(problem("NOT_FOUND", "no such holder file", request.id))
    }

    if (asset.contentType.startsWith("text/html")) {
      reply.header("Content-Security-Policy", pagePolicy)
    }

    return reply
      .code(200)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .type(asset.contentType)
      .send(Buffer.from(asset.bytes))
  })
}

export { registerHolderRoutes }
