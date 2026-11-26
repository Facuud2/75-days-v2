CREATE TABLE "SideQuestTaskLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SideQuestTaskLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SideQuestTaskLog_taskId_periodKey_key" ON "SideQuestTaskLog"("taskId", "periodKey");
CREATE INDEX "SideQuestTaskLog_taskId_idx" ON "SideQuestTaskLog"("taskId");

ALTER TABLE "SideQuestTaskLog" ADD CONSTRAINT "SideQuestTaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SideQuestTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing completed SideQuestTask rows into SideQuestTaskLog
INSERT INTO "SideQuestTaskLog" ("id", "taskId", "periodKey", "value", "completedAt")
SELECT
    gen_random_uuid()::text,
    t."id",
    CASE
        WHEN t."frequency" = 'once' THEN 'once'
        WHEN t."frequency" = 'weekly' THEN 'week-' || GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (COALESCE(t."completedAt", r."startedAt") - r."startedAt")) / 604800)::int + 1)
        ELSE to_char(COALESCE(t."completedAt", r."startedAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    END,
    CASE
        WHEN t."frequency" = 'weekly' AND t."targetValue" IS NOT NULL AND t."targetValue" > 1 AND t."targetValue" <= 14 THEN t."targetValue"
        ELSE 1
    END,
    COALESCE(t."completedAt", NOW())
FROM "SideQuestTask" t
JOIN "SideQuestRun" r ON r."id" = t."runId"
WHERE t."completed" = true
ON CONFLICT ("taskId", "periodKey") DO NOTHING;

-- Un-complete multi-day runs that were prematurely marked completed after only 1 day
UPDATE "SideQuestRun" r
SET "completed" = false, "completedAt" = NULL
FROM "SideQuest" q
WHERE r."sideQuestId" = q."id"
  AND r."completed" = true
  AND q."durationDays" > 1
  AND EXISTS (
      SELECT 1 FROM "SideQuestTask" t
      WHERE t."runId" = r."id" AND t."frequency" IN ('daily', 'weekly')
  );

UPDATE "SideQuest" q
SET
    "completed" = false,
    "progress" = LEAST(q."durationDays", 1),
    "completionCount" = GREATEST(0, q."completionCount" - 1)
WHERE q."completed" = true
  AND q."durationDays" > 1
  AND EXISTS (
      SELECT 1
      FROM "SideQuestRun" r
      JOIN "SideQuestTask" t ON t."runId" = r."id"
      WHERE r."sideQuestId" = q."id"
        AND r."completed" = false
        AND t."frequency" IN ('daily', 'weekly')
  );
