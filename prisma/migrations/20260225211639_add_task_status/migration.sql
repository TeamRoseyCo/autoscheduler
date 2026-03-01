-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "deadline" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "energyType" TEXT NOT NULL DEFAULT 'deep',
    "preferredTimeWindow" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "taskStatus" TEXT NOT NULL DEFAULT 'todo',
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("completed", "createdAt", "deadline", "durationMinutes", "energyType", "id", "preferredTimeWindow", "priority", "projectId", "title", "updatedAt", "userId") SELECT "completed", "createdAt", "deadline", "durationMinutes", "energyType", "id", "preferredTimeWindow", "priority", "projectId", "title", "updatedAt", "userId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
