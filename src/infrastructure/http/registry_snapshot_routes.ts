import type { FastifyInstance } from "fastify"

import { hexOf } from "../../domain/hex.ts"
import { registrySnapshotMaxAgeSeconds } from "../../domain/registry_snapshot_age.ts"
import type { RegistrySnapshot } from "../../types/registry_snapshot.type.ts"
import type { RegistrySnapshotRouteDependencies } from "../../types/registry_snapshot_route_dependencies.type.ts"
import type { RegistrySnapshotWire } from "../../types/registry_snapshot_wire.type.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

function wireOf(snapshot: RegistrySnapshot): RegistrySnapshotWire {
  return {
    generation: snapshot.generation,
    networkId: snapshot.networkId,
    contractAddress: snapshot.contractAddress,
    contractState: hexOf(snapshot.state.contractState),
    zswapChainState: hexOf(snapshot.state.zswapChainState),
    ledgerParameters: hexOf(snapshot.state.ledgerParameters),
    readAt: snapshot.readAt.toISOString()
  }
}

function registerRegistrySnapshotRoutes(
  server: FastifyInstance,
  dependencies: RegistrySnapshotRouteDependencies
): void {
  const { route, snapshots, logger, metrics } = dependencies

  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(route), status: "200" }, 0)

  server.get(route, async (request, reply) => {
    let snapshot: RegistrySnapshot | undefined

    try {
      snapshot = await snapshots.current()
    } catch (error) {
      logger.warn({
        message: "the registry could not be read for a snapshot",
        requestId: request.id,
        fields: { route, cause: error instanceof Error ? error.message : String(error) }
      })
    }

    if (snapshot === undefined) {
      return reply
        .code(503)
        .header("Cache-Control", "no-store")
        .header("Retry-After", String(registrySnapshotMaxAgeSeconds))
        .send(problem("REGISTRY_UNAVAILABLE", "the registry cannot be read now; try again later", request.id))
    }

    return reply
      .code(200)
      .header("Cache-Control", `public, max-age=${registrySnapshotMaxAgeSeconds}`)
      .send(wireOf(snapshot))
  })
}

export { registerRegistrySnapshotRoutes }
