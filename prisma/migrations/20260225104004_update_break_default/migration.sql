-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workStartTime" TEXT NOT NULL DEFAULT '09:00',
    "workEndTime" TEXT NOT NULL DEFAULT '17:00',
    "workDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "deepWorkStart" TEXT NOT NULL DEFAULT '09:00',
    "deepWorkEnd" TEXT NOT NULL DEFAULT '12:00',
    "breakMinutes" INTEGER NOT NULL DEFAULT 5,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
    "openaiApiKey" TEXT,
    "openaiModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    CONSTRAINT "Preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Preferences" ("aiProvider", "breakMinutes", "deepWorkEnd", "deepWorkStart", "id", "openaiApiKey", "openaiModel", "timezone", "userId", "workDays", "workEndTime", "workStartTime") SELECT "aiProvider", "breakMinutes", "deepWorkEnd", "deepWorkStart", "id", "openaiApiKey", "openaiModel", "timezone", "userId", "workDays", "workEndTime", "workStartTime" FROM "Preferences";
DROP TABLE "Preferences";
ALTER TABLE "new_Preferences" RENAME TO "Preferences";
CREATE UNIQUE INDEX "Preferences_userId_key" ON "Preferences"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
