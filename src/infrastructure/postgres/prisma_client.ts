import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "./generated/client.ts"

function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
}

export { createPrismaClient }
