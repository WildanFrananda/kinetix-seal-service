-- CreateTable
CREATE TABLE "delivered_orders" (
    "order_number" VARCHAR(64) NOT NULL,
    "buyer_principal_id" VARCHAR(128) NOT NULL,
    "merchant_principal_id" VARCHAR(128) NOT NULL,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "delivered_orders_pkey" PRIMARY KEY ("order_number")
);
-- CreateTable
CREATE TABLE "reporters" (
    "id" UUID NOT NULL,
    "principal_id" VARCHAR(128) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "reporter_key" VARCHAR(80) NOT NULL,
    "registered_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "reporters_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "report_rights" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "principal_id" VARCHAR(128) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "order_number" VARCHAR(64) NOT NULL,
    "merchant_tag" CHAR(64) NOT NULL,
    "window" INTEGER NOT NULL,
    "leaf" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "report_rights_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "report_right_grants" (
    "right_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "leaf_index" BIGINT,
    "tx_id" VARCHAR(160),
    "attempts" INTEGER NOT NULL,
    "queued_at" TIMESTAMPTZ(6) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "granted_at" TIMESTAMPTZ(6),
    CONSTRAINT "report_right_grants_pkey" PRIMARY KEY ("right_id","generation")
);
-- CreateIndex
CREATE INDEX "delivered_orders_buyer_principal_id_idx" ON "delivered_orders"("buyer_principal_id");
-- CreateIndex
CREATE UNIQUE INDEX "reporters_reporter_key_key" ON "reporters"("reporter_key");
-- CreateIndex
CREATE INDEX "reporters_principal_id_role_registered_at_idx" ON "reporters"("principal_id", "role", "registered_at");
-- CreateIndex
CREATE UNIQUE INDEX "report_rights_leaf_key" ON "report_rights"("leaf");
-- CreateIndex
CREATE INDEX "report_rights_merchant_tag_window_idx" ON "report_rights"("merchant_tag", "window");
-- CreateIndex
CREATE UNIQUE INDEX "report_rights_principal_id_role_order_number_key" ON "report_rights"("principal_id", "role", "order_number");
-- CreateIndex
CREATE INDEX "report_right_grants_generation_status_queued_at_idx" ON "report_right_grants"("generation", "status", "queued_at");
-- AddForeignKey
ALTER TABLE "report_rights" ADD CONSTRAINT "report_rights_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "reporters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "report_right_grants" ADD CONSTRAINT "report_right_grants_right_id_fkey" FOREIGN KEY ("right_id") REFERENCES "report_rights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SeedCursor
INSERT INTO "feed_cursors" ("stream", "through_transaction", "through_sequence") VALUES ('orders', 0, 0);

-- CheckRole
ALTER TABLE "reporters" ADD CONSTRAINT "reporters_role_check" CHECK ("role" IN ('buyer', 'courier'));
ALTER TABLE "report_rights" ADD CONSTRAINT "report_rights_role_check" CHECK ("role" IN ('buyer', 'courier'));
ALTER TABLE "report_right_grants" ADD CONSTRAINT "report_right_grants_status_check" CHECK ("status" IN ('pending', 'uncertain', 'granted'));
