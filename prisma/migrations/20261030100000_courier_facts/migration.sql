-- CreateTable
CREATE TABLE "feed_cursors" (
    "stream" VARCHAR(16) NOT NULL,
    "through_transaction" BIGINT NOT NULL,
    "through_sequence" BIGINT NOT NULL,

    CONSTRAINT "feed_cursors_pkey" PRIMARY KEY ("stream")
);

-- CreateTable
CREATE TABLE "courier_deliveries" (
    "order_number" VARCHAR(128) NOT NULL,
    "driver_principal_id" VARCHAR(128) NOT NULL,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "courier_deliveries_pkey" PRIMARY KEY ("order_number")
);

-- CreateTable
CREATE TABLE "driver_reviews" (
    "review_id" VARCHAR(128) NOT NULL,
    "driver_principal_id" VARCHAR(128) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "driver_reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateIndex
CREATE INDEX "courier_deliveries_driver_principal_id_idx" ON "courier_deliveries"("driver_principal_id");

-- CreateIndex
CREATE INDEX "driver_reviews_driver_principal_id_idx" ON "driver_reviews"("driver_principal_id");

INSERT INTO "feed_cursors" ("stream", "through_transaction", "through_sequence") VALUES ('deliveries', 0, 0), ('reviews', 0, 0);
