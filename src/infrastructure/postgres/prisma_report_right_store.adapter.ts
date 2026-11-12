import type { ReportRightStorePort } from "../../application/ports/report_right_store.port.ts"
import { bytesOf, hexOf } from "../../domain/hex.ts"
import type { HeldRight } from "../../types/held_right.type.ts"
import type { ReportRight } from "../../types/report_right.type.ts"
import type { ReporterRole } from "../../types/reporter_role.type.ts"
import type { RightCandidate } from "../../types/right_candidate.type.ts"
import type { UnsettledGrant } from "../../types/unsettled_grant.type.ts"
import type { PrismaClient } from "./generated/client.ts"

type CandidateRow = {
  reporter_id: string
  reporter_key: string
  principal_id: string
  role: string
  order_number: string
  merchant_principal_id: string
  delivered_at: Date
}

type RightRow = {
  id: string
  reporterId: string
  principalId: string
  role: string
  orderNumber: string
  merchantTag: string
  window: number
  leaf: string
  createdAt: Date
}

const roles: readonly ReporterRole[] = ["buyer", "courier"]

function roleOf(stored: string): ReporterRole {
  const role = roles.find((candidate) => candidate === stored)

  if (role === undefined) {
    throw new Error(`report_rights holds an unknown role: ${stored}`)
  }

  return role
}

function rightOf(row: RightRow): ReportRight {
  return {
    id: row.id,
    reporterId: row.reporterId,
    principalId: row.principalId,
    role: roleOf(row.role),
    orderNumber: row.orderNumber,
    merchantTag: bytesOf(row.merchantTag),
    window: row.window,
    leaf: bytesOf(row.leaf),
    createdAt: row.createdAt
  }
}

class PrismaReportRightStore implements ReportRightStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async candidates(limit: number): Promise<RightCandidate[]> {
    const rows = await this.prisma.$queryRaw<CandidateRow[]>`
      WITH "current_keys" AS (
        SELECT DISTINCT ON ("principal_id", "role") "id", "principal_id", "role", "reporter_key"
        FROM "reporters"
        ORDER BY "principal_id", "role", "registered_at" DESC, "id" DESC
      ),
      "held_orders" AS (
        SELECT "keys"."id" AS "reporter_id", "keys"."reporter_key", "keys"."principal_id", "keys"."role",
          "orders"."order_number", "orders"."merchant_principal_id", "orders"."delivered_at"
        FROM "current_keys" AS "keys"
        JOIN "delivered_orders" AS "orders" ON "orders"."buyer_principal_id" = "keys"."principal_id"
        WHERE "keys"."role" = 'buyer'
        UNION ALL
        SELECT "keys"."id", "keys"."reporter_key", "keys"."principal_id", "keys"."role",
          "orders"."order_number", "orders"."merchant_principal_id", "orders"."delivered_at"
        FROM "current_keys" AS "keys"
        JOIN "courier_deliveries" AS "carried" ON "carried"."driver_principal_id" = "keys"."principal_id"
        JOIN "delivered_orders" AS "orders" ON "orders"."order_number" = "carried"."order_number"
        WHERE "keys"."role" = 'courier'
      )
      SELECT "held".* FROM "held_orders" AS "held"
      WHERE NOT EXISTS (
        SELECT 1 FROM "report_rights" AS "rights"
        WHERE "rights"."principal_id" = "held"."principal_id"
          AND "rights"."role" = "held"."role"
          AND "rights"."order_number" = "held"."order_number"
      )
      ORDER BY "held"."delivered_at", "held"."order_number", "held"."principal_id"
      LIMIT ${limit}
    `

    return rows.map((row) => ({
      reporterId: row.reporter_id,
      reporterKey: BigInt(row.reporter_key),
      principalId: row.principal_id,
      role: roleOf(row.role),
      orderNumber: row.order_number,
      merchantPrincipalId: row.merchant_principal_id,
      deliveredAt: row.delivered_at
    }))
  }

  async insert(rights: ReportRight[]): Promise<number> {
    if (rights.length === 0) {
      return 0
    }

    const created = await this.prisma.reportRight.createMany({
      data: rights.map((right) => ({
        id: right.id,
        reporterId: right.reporterId,
        principalId: right.principalId,
        role: right.role,
        orderNumber: right.orderNumber,
        merchantTag: hexOf(right.merchantTag),
        window: right.window,
        leaf: hexOf(right.leaf),
        createdAt: right.createdAt
      })),
      skipDuplicates: true
    })

    return created.count
  }

  async queueAll(generation: number, at: Date): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO "report_right_grants" ("right_id", "generation", "status", "attempts", "queued_at")
      SELECT "rights"."id", ${generation}::integer, 'pending', 0, ${at}::timestamptz
      FROM "report_rights" AS "rights"
      WHERE NOT EXISTS (
        SELECT 1 FROM "report_right_grants" AS "existing"
        WHERE "existing"."right_id" = "rights"."id" AND "existing"."generation" = ${generation}::integer
      )
      ON CONFLICT DO NOTHING
    `
  }

  async nextUnsettled(generation: number): Promise<UnsettledGrant | undefined> {
    const row = await this.prisma.reportRightGrant.findFirst({
      where: { generation, status: { in: ["pending", "uncertain"] } },
      orderBy: [{ queuedAt: "asc" }, { rightId: "asc" }],
      include: { right: true }
    })

    if (row === null) {
      return undefined
    }

    return { right: rightOf(row.right), status: row.status === "uncertain" ? "uncertain" : "pending" }
  }

  async markUncertain(rightId: string, generation: number, at: Date): Promise<void> {
    await this.prisma.reportRightGrant.update({
      where: { rightId_generation: { rightId, generation } },
      data: { status: "uncertain", attempts: { increment: 1 }, submittedAt: at }
    })
  }

  async markGranted(
    rightId: string,
    generation: number,
    leafIndex: bigint,
    txId: string | undefined,
    at: Date
  ): Promise<void> {
    await this.prisma.reportRightGrant.update({
      where: { rightId_generation: { rightId, generation } },
      data: { status: "granted", leafIndex, txId: txId ?? null, grantedAt: at }
    })
  }

  async heldBy(principalId: string, generation: number | undefined): Promise<HeldRight[]> {
    const rows = await this.prisma.reportRight.findMany({
      where: { principalId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        reporter: true,
        grants: generation === undefined ? false : { where: { generation, status: "granted" } }
      }
    })

    const crowds = new Map<string, number>()
    const held: HeldRight[] = []

    for (const row of rows) {
      const crowdKey = `${row.merchantTag}:${row.window}`

      if (generation !== undefined && !crowds.has(crowdKey)) {
        crowds.set(crowdKey, await this.crowdOf(generation, row.merchantTag, row.window))
      }

      const grant = row.grants?.[0]
      const order = await this.prisma.deliveredOrder.findUnique({ where: { orderNumber: row.orderNumber } })

      if (order === null) {
        throw new Error(`report right ${row.id} names an order seal does not hold`)
      }

      held.push({
        id: row.id,
        role: roleOf(row.role),
        orderNumber: row.orderNumber,
        reporterKey: BigInt(row.reporter.reporterKey),
        merchantTag: bytesOf(row.merchantTag),
        window: row.window,
        deliveredAt: order.deliveredAt,
        leafIndex: grant?.leafIndex ?? undefined,
        crowd: crowds.get(crowdKey) ?? 0
      })
    }

    return held
  }

  private async crowdOf(generation: number, merchantTag: string, window: number): Promise<number> {
    const holders = await this.prisma.reportRight.findMany({
      where: { merchantTag, window, grants: { some: { generation, status: "granted" } } },
      distinct: ["reporterId"],
      select: { reporterId: true }
    })

    return holders.length
  }
}

export default PrismaReportRightStore
