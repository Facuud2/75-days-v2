ALTER TABLE "SideQuest" ADD COLUMN "templateId" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "completionCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SideQuestTaskTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "targetValue" INTEGER,
    "targetUnit" TEXT,
    CONSTRAINT "SideQuestTaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SideQuestRun" (
    "id" TEXT NOT NULL,
    "sideQuestId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SideQuestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SideQuestTask" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "targetValue" INTEGER,
    "targetUnit" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SideQuestTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SideQuestRun_sideQuestId_runNumber_key" ON "SideQuestRun"("sideQuestId", "runNumber");
CREATE INDEX "SideQuestRun_sideQuestId_completed_idx" ON "SideQuestRun"("sideQuestId", "completed");
CREATE INDEX "SideQuestTask_runId_order_idx" ON "SideQuestTask"("runId", "order");

ALTER TABLE "SideQuest" ADD CONSTRAINT "SideQuest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SideQuestTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SideQuestTaskTemplate" ADD CONSTRAINT "SideQuestTaskTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SideQuestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SideQuestRun" ADD CONSTRAINT "SideQuestRun_sideQuestId_fkey" FOREIGN KEY ("sideQuestId") REFERENCES "SideQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SideQuestTask" ADD CONSTRAINT "SideQuestTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SideQuestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SideQuestTask" ADD CONSTRAINT "SideQuestTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "SideQuestTaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
