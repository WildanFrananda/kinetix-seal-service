import type { FastifyInstance } from "fastify"

import type { VerifierRouteDependencies } from "../../types/verifier_route_dependencies.type.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const pageRoute = "/api/v1/seal/verify"
const assetRoute = "/api/v1/seal/verify/assets/:digest/:file"
const pagePolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob: mediastream:",
  "img-src 'self' data: blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ")

function pageOf(digest: string): string {
  const assets = `${pageRoute}/assets/${digest}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Check a courier's credential · Kinetix</title>
    <link rel="stylesheet" href="${assets}/verifier.css">
  </head>
  <body>
    <main id="verifier">
      <h1>Check a courier's credential</h1>
      <noscript>This page needs JavaScript to read the courier's answer.</noscript>
    </main>
    <script type="module" src="${assets}/verifier.js"></script>
  </body>
</html>
`
}

function registerVerifierRoutes(server: FastifyInstance, dependencies: VerifierRouteDependencies): void {
  const { assets, metrics } = dependencies
  const page = pageOf(assets.digest)

  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(pageRoute), status: "200" }, 0)
  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(assetRoute), status: "200" }, 0)

  server.get(pageRoute, async (_request, reply) => {
    return reply
      .code(200)
      .header("Cache-Control", "no-cache")
      .header("Content-Security-Policy", pagePolicy)
      .header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Content-Type-Options", "nosniff")
      .type("text/html; charset=utf-8")
      .send(page)
  })

  server.get<{ Params: { digest: string; file: string } }>(assetRoute, async (request, reply) => {
    const asset = assets.file(request.params.digest, request.params.file)

    if (asset === undefined) {
      return reply
        .code(404)
        .header("Cache-Control", "no-store")
        .send(problem("NOT_FOUND", "no such verifier file", request.id))
    }

    return reply
      .code(200)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .type(asset.contentType)
      .send(Buffer.from(asset.bytes))
  })
}

export { registerVerifierRoutes }
