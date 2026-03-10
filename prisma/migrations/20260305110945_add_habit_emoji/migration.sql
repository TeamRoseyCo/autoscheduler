-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🔄',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "projectId" TEXT,
    "preferredTime" TEXT,
    "energyType" TEXT NOT NULL DEFAULT 'light',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Habit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("active", "createdAt", "durationMinutes", "energyType", "frequency", "id", "preferredTime", "projectId", "title", "updatedAt", "userId") SELECT "active", "createdAt", "durationMinutes", "energyType", "frequency", "id", "preferredTime", "projectId", "title", "updatedAt", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
