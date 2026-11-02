-- AlterTable
ALTER TABLE "feed_cursors" ADD COLUMN     "caught_up_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "principal_id" VARCHAR(128) NOT NULL,
    "class_id" CHAR(64) NOT NULL,
    "attributes" BIGINT[],
    "salt" CHAR(64) NOT NULL,
    "holder_public_key" VARCHAR(80) NOT NULL,
    "issue_day" INTEGER NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_issuances" (
    "credential_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "leaf" CHAR(64),
    "leaf_index" BIGINT,
    "tx_id" VARCHAR(160),
    "attempts" INTEGER NOT NULL,
    "queued_at" TIMESTAMPTZ(6) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "issued_at" TIMESTAMPTZ(6),

    CONSTRAINT "credential_issuances_pkey" PRIMARY KEY ("credential_id","generation")
);

-- CreateIndex
CREATE INDEX "credentials_principal_id_class_id_requested_at_idx" ON "credentials"("principal_id", "class_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_principal_id_class_id_issue_day_key" ON "credentials"("principal_id", "class_id", "issue_day");

-- CreateIndex
CREATE INDEX "credential_issuances_generation_status_queued_at_idx" ON "credential_issuances"("generation", "status", "queued_at");

-- AddForeignKey
ALTER TABLE "credential_issuances" ADD CONSTRAINT "credential_issuances_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
