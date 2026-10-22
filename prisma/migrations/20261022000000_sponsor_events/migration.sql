CREATE TABLE "sponsor_events" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "condition" VARCHAR(16) NOT NULL,
    "dust_balance" DECIMAL(39,0) NOT NULL,
    "dust_coins" INTEGER NOT NULL,
    "night_utxos" INTEGER NOT NULL,

    CONSTRAINT "sponsor_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sponsor_events_occurred_at_idx" ON "sponsor_events"("occurred_at");
