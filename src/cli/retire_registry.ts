import RegistryDrill from "../application/registry_drill.service.ts"
import SettingReader from "../infrastructure/config/setting_reader.ts"
import JsonLogger from "../infrastructure/observability/json_logger.ts"
import { redactOutput } from "../infrastructure/observability/redacting_output.ts"
import { createPrismaClient } from "../infrastructure/postgres/prisma_client.ts"
import PrismaRegistryGenerationStore from "../infrastructure/postgres/prisma_registry_generation_store.adapter.ts"

const read = new SettingReader(process.env)
const databaseUrl = read.url("KINETIX_SEAL_DATABASE_URL", ["postgresql:", "postgres:"])
const generation = read.positiveInteger("KINETIX_SEAL_DRILL_GENERATION")

read.verify()
redactOutput([{ value: databaseUrl, placeholder: "<database_url>" }])

const logger = new JsonLogger("kinetix-seal-retire-registry", "info", (line) => {
  process.stdout.write(line)
})

const prisma = createPrismaClient(databaseUrl)

try {
  const outcome = await new RegistryDrill(new PrismaRegistryGenerationStore(prisma)).retire(generation)

  if (outcome.kind === "retired") {
    logger.warn({
      message: "the registry generation was retired for a drill; the service deploys the next one on its next check",
      fields: { generation: outcome.generation, network_id: outcome.networkId }
    })
  } else {
    logger.error({
      message: "the drill was refused",
      fields: { generation, reason: outcome.reason, active_generation: outcome.activeGeneration ?? null }
    })

    process.exitCode = 1
  }
} finally {
  await prisma.$disconnect()
}
