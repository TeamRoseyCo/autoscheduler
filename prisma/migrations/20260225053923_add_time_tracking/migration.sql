-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduledBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "googleEventId" TEXT,
    "title" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "date" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'indigo',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledBlock" ("color", "createdAt", "date", "endTime", "googleEventId", "id", "startTime", "taskId", "title", "userId") SELECT "color", "createdAt", "date", "endTime", "googleEventId", "id", "startTime", "taskId", "title", "userId" FROM "ScheduledBlock";
DROP TABLE "ScheduledBlock";
ALTER TABLE "new_ScheduledBlock" RENAME TO "ScheduledBlock";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
