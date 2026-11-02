import type { PredicatePlacementStorePort } from "../../application/ports/predicate_placement_store.port.ts"
import { bytesOf, hexOf } from "../../domain/hex.ts"
import type { PlacedPredicate } from "../../types/placed_predicate.type.ts"
import type { PrismaClient } from "./generated/client.ts"

class PrismaPredicatePlacementStore implements PredicatePlacementStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async replace(generation: number, placed: readonly PlacedPredicate[], at: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.predicatePlacement.deleteMany(),
      this.prisma.predicatePlacement.createMany({
        data: placed.map((placement) => ({
          generation,
          predicateId: hexOf(placement.id),
          classId: hexOf(placement.predicate.classId),
          minimums: placement.predicate.minimums,
          observedAt: at
        }))
      })
    ])
  }

  async ofGeneration(generation: number): Promise<PlacedPredicate[]> {
    const rows = await this.prisma.predicatePlacement.findMany({
      where: { generation },
      orderBy: { predicateId: "asc" }
    })

    return rows.map((row) => ({
      id: bytesOf(row.predicateId),
      predicate: { classId: bytesOf(row.classId), minimums: row.minimums }
    }))
  }
}

export default PrismaPredicatePlacementStore
