-- CreateTable
CREATE TABLE "SmartImportConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "gmailQuery" TEXT,
    "lastScanAt" DATETIME,
    "lastScanStatus" TEXT,
    "lastScanError" TEXT,
    "lastScanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartImportConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmartImportEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "configId" TEXT,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "confidence" REAL NOT NULL DEFAULT 0.7,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suggestedByAI" BOOLEAN NOT NULL DEFAULT false,
    "scheduledBlockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartImportEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartImportEvent_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SmartImportConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
