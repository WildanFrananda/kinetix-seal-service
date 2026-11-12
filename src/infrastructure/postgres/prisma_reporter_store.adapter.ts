import type { ReporterStorePort } from "../../application/ports/reporter_store.port.ts"
import type { ReporterRecord } from "../../types/reporter_record.type.ts"
import type { ReporterRole } from "../../types/reporter_role.type.ts"
import { Prisma, type PrismaClient } from "./generated/client.ts"

const roles: readonly ReporterRole[] = ["buyer", "courier"]

function roleOf(stored: string): ReporterRole {
  const role = roles.find((candidate) => candidate === stored)

  if (role === undefined) {
    throw new Error(`reporters holds an unknown role: ${stored}`)
  }

  return role
}

class PrismaReporterStore implements ReporterStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async byKey(reporterKey: bigint): Promise<ReporterRecord | undefined> {
    const row = await this.prisma.reporter.findUnique({ where: { reporterKey: reporterKey.toString() } })

    if (row === null) {
      return undefined
    }

    return {
      id: row.id,
      principalId: row.principalId,
      role: roleOf(row.role),
      reporterKey: BigInt(row.reporterKey),
      registeredAt: row.registeredAt
    }
  }

  async record(reporter: ReporterRecord): Promise<"recorded" | "conflict"> {
    try {
      await this.prisma.reporter.create({
        data: {
          id: reporter.id,
          principalId: reporter.principalId,
          role: reporter.role,
          reporterKey: reporter.reporterKey.toString(),
          registeredAt: reporter.registeredAt
        }
      })

      return "recorded"
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return "conflict"
      }

      throw error
    }
  }
}

export default PrismaReporterStore
