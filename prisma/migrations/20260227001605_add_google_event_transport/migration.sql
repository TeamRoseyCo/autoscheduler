-- CreateTable
CREATE TABLE "GoogleEventTransport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "location" TEXT,
    "transportBefore" INTEGER,
    "transportAfter" INTEGER,
    "transportMode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleEventTransport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleEventTransport_userId_googleEventId_key" ON "GoogleEventTransport"("userId", "googleEventId");
