-- CreateTable
CREATE TABLE "registry_generations" (
    "generation" INTEGER NOT NULL,
    "contract_address" VARCHAR(128) NOT NULL,
    "network_id" VARCHAR(32) NOT NULL,
    "build_digest" CHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "deploy_tx_id" VARCHAR(160),
    "anchor_height" BIGINT,
    "anchor_hash" CHAR(64),
    "retired_reason" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),

    CONSTRAINT "registry_generations_pkey" PRIMARY KEY ("generation")
);

-- CreateIndex
CREATE UNIQUE INDEX "registry_generations_contract_address_key" ON "registry_generations"("contract_address");

-- CreateIndex
CREATE INDEX "registry_generations_status_idx" ON "registry_generations"("status");
