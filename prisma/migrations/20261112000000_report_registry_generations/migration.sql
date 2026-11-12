-- AlterTable
ALTER TABLE "registry_generations" ADD COLUMN "registry" VARCHAR(16) NOT NULL DEFAULT 'credential';
ALTER TABLE "registry_generations" ALTER COLUMN "registry" DROP DEFAULT;
ALTER TABLE "registry_generations" ADD CONSTRAINT "registry_generations_registry_check" CHECK ("registry" IN ('credential', 'report'));
ALTER TABLE "registry_generations" DROP CONSTRAINT "registry_generations_pkey",
ADD CONSTRAINT "registry_generations_pkey" PRIMARY KEY ("registry", "generation");

-- DropIndex
DROP INDEX "registry_generations_status_idx";

-- CreateIndex
CREATE INDEX "registry_generations_registry_status_idx" ON "registry_generations"("registry", "status");
