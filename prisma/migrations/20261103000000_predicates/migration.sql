-- CreateTable
CREATE TABLE "predicate_templates" (
    "id" UUID NOT NULL,
    "class_id" CHAR(64) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "minimums" BIGINT[],
    "freshness_days" INTEGER NOT NULL,
    "approved_by" VARCHAR(128) NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL,
    "withdrawn_by" VARCHAR(128),
    "withdrawn_at" TIMESTAMPTZ(6),

    CONSTRAINT "predicate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predicate_placements" (
    "generation" INTEGER NOT NULL,
    "predicate_id" CHAR(64) NOT NULL,
    "class_id" CHAR(64) NOT NULL,
    "minimums" BIGINT[],
    "observed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "predicate_placements_pkey" PRIMARY KEY ("generation","predicate_id")
);

-- CreateIndex
CREATE INDEX "predicate_templates_class_id_withdrawn_at_idx" ON "predicate_templates"("class_id", "withdrawn_at");
