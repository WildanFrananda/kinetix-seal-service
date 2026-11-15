CREATE TABLE IF NOT EXISTS "report_categories" (
  "slug" VARCHAR(48) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "report_categories_pkey" PRIMARY KEY ("slug"),
  CONSTRAINT "report_categories_slug_nonempty" CHECK (length(trim("slug")) > 0),
  CONSTRAINT "report_categories_label_nonempty" CHECK (length(trim("label")) > 0)
);

CREATE TABLE IF NOT EXISTS "filed_reports" (
  "nullifier" VARCHAR(64) NOT NULL,
  "category_slug" VARCHAR(48) NOT NULL,
  "body" TEXT NOT NULL,
  "salt" VARCHAR(64) NOT NULL,
  "digest" VARCHAR(64) NOT NULL,
  "merchant_tag" VARCHAR(64) NOT NULL,
  "window" BIGINT NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "first_generation" INTEGER NOT NULL,
  "tx_id" VARCHAR(160),
  "submitted_at" TIMESTAMPTZ(6) NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),

  CONSTRAINT "filed_reports_pkey" PRIMARY KEY ("nullifier"),
  CONSTRAINT "filed_reports_status_check" CHECK ("status" IN ('submitted', 'confirmed')),
  CONSTRAINT "filed_reports_nullifier_hex" CHECK (length("nullifier") = 64),
  CONSTRAINT "filed_reports_salt_hex" CHECK (length("salt") = 64),
  CONSTRAINT "filed_reports_digest_hex" CHECK (length("digest") = 64),
  CONSTRAINT "filed_reports_merchant_tag_hex" CHECK (length("merchant_tag") = 64),
  CONSTRAINT "filed_reports_window_nonneg" CHECK ("window" >= 0)
);

CREATE TABLE IF NOT EXISTS "report_seeds" (
  "nullifier" VARCHAR(64) NOT NULL,
  "generation" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "tx_id" VARCHAR(160),
  "attempts" INTEGER NOT NULL,
  "queued_at" TIMESTAMPTZ(6) NOT NULL,
  "submitted_at" TIMESTAMPTZ(6),
  "seeded_at" TIMESTAMPTZ(6),

  CONSTRAINT "report_seeds_pkey" PRIMARY KEY ("nullifier", "generation"),
  CONSTRAINT "report_seeds_status_check" CHECK ("status" IN ('pending', 'uncertain', 'seeded')),
  CONSTRAINT "report_seeds_attempts_nonneg" CHECK ("attempts" >= 0)
);

CREATE INDEX IF NOT EXISTS "filed_reports_merchant_tag_window_idx" ON "filed_reports"("merchant_tag", "window");
CREATE INDEX IF NOT EXISTS "filed_reports_status_submitted_at_idx" ON "filed_reports"("status", "submitted_at");
CREATE INDEX IF NOT EXISTS "report_seeds_generation_status_queued_at_idx" ON "report_seeds"("generation", "status", "queued_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'filed_reports_category_slug_fkey') THEN
    ALTER TABLE "filed_reports"
      ADD CONSTRAINT "filed_reports_category_slug_fkey"
      FOREIGN KEY ("category_slug") REFERENCES "report_categories"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_seeds_nullifier_fkey') THEN
    ALTER TABLE "report_seeds"
      ADD CONSTRAINT "report_seeds_nullifier_fkey"
      FOREIGN KEY ("nullifier") REFERENCES "filed_reports"("nullifier") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "report_categories" ("slug", "label")
VALUES
  ('counterfeit', 'Counterfeit product'),
  ('fraud', 'Fraud or misrepresentation'),
  ('abuse', 'Abusive conduct')
ON CONFLICT ("slug") DO NOTHING;
