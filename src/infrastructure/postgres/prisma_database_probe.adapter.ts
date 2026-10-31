import type { DatabaseProbePort } from "../../application/ports/database_probe.port.ts"
import type { PrismaClient } from "./generated/client.ts"

class PrismaDatabaseProbe implements DatabaseProbePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async reachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`

      return true
    } catch {
      return false
    }
  }
}

export default PrismaDatabaseProbe
