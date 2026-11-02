import type { CredentialStorePort } from "../../application/ports/credential_store.port.ts"
import { bytesOf, hexOf } from "../../domain/hex.ts"
import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { IssuanceRecord } from "../../types/issuance_record.type.ts"
import type { IssuanceStatus } from "../../types/issuance_status.type.ts"
import type { UnsettledIssuance } from "../../types/unsettled_issuance.type.ts"
import { Prisma, type PrismaClient } from "./generated/client.ts"

type CredentialRow = Prisma.CredentialGetPayload<Record<string, never>>
type IssuanceRow = Prisma.CredentialIssuanceGetPayload<Record<string, never>>

const statuses: readonly IssuanceStatus[] = ["pending", "uncertain", "issued"]

function credentialOf(row: CredentialRow): CredentialRecord {
  return {
    id: row.id,
    principalId: row.principalId,
    classId: bytesOf(row.classId),
    attributes: row.attributes,
    salt: bytesOf(row.salt),
    holderPublicKey: BigInt(row.holderPublicKey),
    issueDay: row.issueDay,
    requestedAt: row.requestedAt
  }
}

function issuanceOf(row: IssuanceRow): IssuanceRecord {
  const status = statuses.find((candidate) => candidate === row.status)

  if (status === undefined) {
    throw new Error(
      `credential_issuances row ${row.credentialId}/${row.generation} holds an unknown status: ${row.status}`
    )
  }

  return {
    credentialId: row.credentialId,
    generation: row.generation,
    status,
    leaf: row.leaf === null ? undefined : bytesOf(row.leaf),
    leafIndex: row.leafIndex ?? undefined,
    txId: row.txId ?? undefined
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

class PrismaCredentialStore implements CredentialStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async forDay(principalId: string, classId: Uint8Array, issueDay: number): Promise<CredentialRecord | undefined> {
    const row = await this.prisma.credential.findUnique({
      where: { principalId_classId_issueDay: { principalId, classId: hexOf(classId), issueDay } }
    })

    return row === null ? undefined : credentialOf(row)
  }

  async record(credential: CredentialRecord): Promise<"recorded" | "conflict"> {
    try {
      await this.prisma.credential.create({
        data: {
          id: credential.id,
          principalId: credential.principalId,
          classId: hexOf(credential.classId),
          attributes: credential.attributes,
          salt: hexOf(credential.salt),
          holderPublicKey: credential.holderPublicKey.toString(),
          issueDay: credential.issueDay,
          requestedAt: credential.requestedAt
        }
      })

      return "recorded"
    } catch (error) {
      if (isUniqueViolation(error)) {
        return "conflict"
      }

      throw error
    }
  }

  async byId(id: string): Promise<CredentialRecord | undefined> {
    const row = await this.prisma.credential.findUnique({ where: { id } })

    return row === null ? undefined : credentialOf(row)
  }

  async isCurrent(credential: CredentialRecord): Promise<boolean> {
    const newer = await this.prisma.credential.findFirst({
      where: {
        principalId: credential.principalId,
        classId: hexOf(credential.classId),
        OR: [
          { requestedAt: { gt: credential.requestedAt } },
          { requestedAt: credential.requestedAt, id: { gt: credential.id } }
        ]
      },
      select: { id: true }
    })

    return newer === null
  }

  async issuanceOf(credentialId: string, generation: number): Promise<IssuanceRecord | undefined> {
    const row = await this.prisma.credentialIssuance.findUnique({
      where: { credentialId_generation: { credentialId, generation } }
    })

    return row === null ? undefined : issuanceOf(row)
  }

  async queueCurrent(generation: number, at: Date): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO "credential_issuances" ("credential_id", "generation", "status", "attempts", "queued_at")
      SELECT "current"."id", ${generation}::integer, 'pending', 0, ${at}::timestamptz
      FROM (
        SELECT DISTINCT ON ("principal_id", "class_id") "id"
        FROM "credentials"
        ORDER BY "principal_id", "class_id", "requested_at" DESC, "id" DESC
      ) AS "current"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "credential_issuances" AS "existing"
        WHERE "existing"."credential_id" = "current"."id" AND "existing"."generation" = ${generation}::integer
      )
      ON CONFLICT DO NOTHING
    `
  }

  async nextUnsettled(generation: number): Promise<UnsettledIssuance | undefined> {
    const row = await this.prisma.credentialIssuance.findFirst({
      where: { generation, status: { in: ["pending", "uncertain"] } },
      orderBy: [{ queuedAt: "asc" }, { credentialId: "asc" }],
      include: { credential: true }
    })

    if (row === null) {
      return undefined
    }

    const { credential, ...issuance } = row

    return { issuance: issuanceOf(issuance), credential: credentialOf(credential) }
  }

  async markUncertain(credentialId: string, generation: number, leaf: Uint8Array, at: Date): Promise<void> {
    await this.prisma.credentialIssuance.update({
      where: { credentialId_generation: { credentialId, generation } },
      data: { status: "uncertain", leaf: hexOf(leaf), attempts: { increment: 1 }, submittedAt: at }
    })
  }

  async markIssued(
    credentialId: string,
    generation: number,
    leafIndex: bigint,
    txId: string | undefined,
    at: Date
  ): Promise<void> {
    await this.prisma.credentialIssuance.update({
      where: { credentialId_generation: { credentialId, generation } },
      data: { status: "issued", leafIndex, issuedAt: at, ...(txId === undefined ? {} : { txId }) }
    })
  }
}

export default PrismaCredentialStore
