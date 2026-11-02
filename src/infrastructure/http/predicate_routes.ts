import type { FastifyInstance } from "fastify"

import { classNamed, classWithId } from "../../domain/credential_classes.ts"
import { hexOf } from "../../domain/hex.ts"
import { dateOfIssueDay } from "../../domain/issue_day.ts"
import { draftPredicate } from "../../domain/predicate_draft.ts"
import { maxLiveTemplatesPerClass } from "../../domain/predicate_limits.ts"
import type { PredicateDraft } from "../../types/predicate_draft.type.ts"
import type { PredicateListing } from "../../types/predicate_listing.type.ts"
import type { PredicateListingView } from "../../types/predicate_listing_view.type.ts"
import type { PredicateRouteDependencies } from "../../types/predicate_route_dependencies.type.ts"
import type { PredicateStanding } from "../../types/predicate_standing.type.ts"
import type { PredicateView } from "../../types/predicate_view.type.ts"
import { callerOf } from "./caller_of.ts"
import { isLowercaseUuid } from "./lowercase_uuid.ts"
import { problem } from "./problem.ts"
import { routeTemplate } from "./route_template.ts"

const collectionRoute = "/api/v1/seal/predicates"
const memberRoute = "/api/v1/seal/predicates/:id"
const requestBodyLimit = 2048
const publicCaching = "public, max-age=60"
const draftKeys = ["class", "label", "minimums", "freshnessDays"]

function hasExactly(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const present = Object.keys(value)

  return present.length === keys.length && keys.every((key) => present.includes(key))
}

function minimumOf(value: unknown): bigint | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return undefined
  }

  return BigInt(value)
}

function draftOf(body: unknown): PredicateDraft | undefined {
  if (!hasExactly(body, draftKeys)) {
    return undefined
  }

  const credentialClass = typeof body.class === "string" ? classNamed(body.class) : undefined

  if (credentialClass === undefined || typeof body.label !== "string" || typeof body.freshnessDays !== "number") {
    return undefined
  }

  const names = credentialClass.thresholds.map((threshold) => threshold.name)
  const given = body.minimums

  if (!hasExactly(given, names)) {
    return undefined
  }

  const minimums: bigint[] = []

  for (const name of names) {
    const minimum = minimumOf(given[name])

    if (minimum === undefined) {
      return undefined
    }

    minimums.push(minimum)
  }

  return draftPredicate(credentialClass, body.label, minimums, body.freshnessDays)
}

function viewOf(standing: PredicateStanding): PredicateView {
  const { template, rows } = standing
  const credentialClass = classWithId(template.classId)

  if (credentialClass === undefined) {
    throw new Error(`predicate ${template.id} names a class seal does not know`)
  }

  return {
    id: template.id,
    status: template.withdrawnAt === undefined ? "live" : "withdrawn",
    class: credentialClass.name,
    classId: hexOf(template.classId),
    label: template.label,
    minimums: Object.fromEntries(
      credentialClass.thresholds.map((threshold, index) => [threshold.name, Number(template.minimums[index])])
    ),
    freshnessDays: template.freshnessDays,
    approvedAt: template.approvedAt.toISOString(),
    withdrawnAt: template.withdrawnAt === undefined ? null : template.withdrawnAt.toISOString(),
    rows: rows.map((row) => ({
      id: hexOf(row.id),
      minimums: row.predicate.minimums.map((minimum) => minimum.toString()),
      minimumIssueDay: row.minimumIssueDay,
      minimumIssueDate: dateOfIssueDay(row.minimumIssueDay),
      current: row.current,
      placed: row.placed
    }))
  }
}

function listingViewOf(listing: PredicateListing): PredicateListingView {
  return {
    registry: listing.registry ?? null,
    predicates: listing.standings.map(viewOf)
  }
}

function registerPredicateRoutes(server: FastifyInstance, dependencies: PredicateRouteDependencies): void {
  const { metrics, predicates, clock } = dependencies

  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(collectionRoute), status: "200" }, 0)
  metrics.httpRequests.inc({ method: "GET", route: routeTemplate(memberRoute), status: "200" }, 0)
  metrics.httpRequests.inc({ method: "POST", route: routeTemplate(collectionRoute), status: "201" }, 0)
  metrics.httpRequests.inc({ method: "DELETE", route: routeTemplate(memberRoute), status: "204" }, 0)

  server.get(collectionRoute, async (_request, reply) => {
    const listing = await predicates.listing(clock())

    return reply.code(200).header("Cache-Control", publicCaching).send(listingViewOf(listing))
  })

  server.get<{ Params: { id: string } }>(memberRoute, async (request, reply) => {
    const { id } = request.params
    const standing = isLowercaseUuid(id) ? await predicates.standing(id, clock()) : undefined

    if (standing === undefined) {
      return reply
        .code(404)
        .header("Cache-Control", "no-store")
        .send(problem("NOT_FOUND", "no such predicate", request.id))
    }

    return reply.code(200).header("Cache-Control", publicCaching).send(viewOf(standing))
  })

  server.post(collectionRoute, { bodyLimit: requestBodyLimit }, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const draft = draftOf(request.body)

    if (draft === undefined) {
      return reply
        .code(400)
        .send(
          problem(
            "INVALID_REQUEST",
            "the body must be { class, label, minimums, freshnessDays } within the class's bounds",
            request.id
          )
        )
    }

    const outcome = await predicates.approve(caller, draft, clock())

    switch (outcome.kind) {
      case "approved":
        return reply
          .code(201)
          .header("Location", `${collectionRoute}/${outcome.standing.template.id}`)
          .send(viewOf(outcome.standing))
      case "not_admin":
        return reply.code(403).send(problem("ADMIN_REQUIRED", "only an admin approves predicates", request.id))
      case "duplicate":
        return reply
          .code(409)
          .send(problem("PREDICATE_EXISTS", "a live predicate already has these minimums", request.id))
      case "full":
        return reply
          .code(409)
          .send(
            problem(
              "TOO_MANY_PREDICATES",
              `a class holds at most ${maxLiveTemplatesPerClass} live predicates; withdraw one first`,
              request.id
            )
          )
    }
  })

  server.delete<{ Params: { id: string } }>(memberRoute, async (request, reply) => {
    reply.header("Cache-Control", "no-store")

    const caller = await callerOf(dependencies, request, reply)

    if (caller === undefined) {
      return reply
    }

    const { id } = request.params
    const outcome = isLowercaseUuid(id) ? await predicates.withdraw(caller, id, clock()) : "absent"

    switch (outcome) {
      case "withdrawn":
      case "already_withdrawn":
        return reply.code(204).send()
      case "not_admin":
        return reply.code(403).send(problem("ADMIN_REQUIRED", "only an admin withdraws predicates", request.id))
      case "absent":
        return reply.code(404).send(problem("NOT_FOUND", "no such predicate", request.id))
    }
  })
}

export { registerPredicateRoutes }
