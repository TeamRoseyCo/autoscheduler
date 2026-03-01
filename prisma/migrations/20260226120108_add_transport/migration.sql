-- AlterTable
ALTER TABLE "Preferences" ADD COLUMN "googleMapsApiKey" TEXT;
ALTER TABLE "Preferences" ADD COLUMN "savedPlaces" TEXT;

-- AlterTable
ALTER TABLE "ScheduledBlock" ADD COLUMN "location" TEXT;
ALTER TABLE "ScheduledBlock" ADD COLUMN "transportAfter" INTEGER;
ALTER TABLE "ScheduledBlock" ADD COLUMN "transportBefore" INTEGER;
ALTER TABLE "ScheduledBlock" ADD COLUMN "transportMode" TEXT;
