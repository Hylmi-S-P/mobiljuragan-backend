-- CreateEnum
CREATE TYPE "DriverRoute" AS ENUM ('DALAM_KOTA', 'LUAR_KOTA');

-- CreateEnum
CREATE TYPE "DriverReadiness" AS ENUM ('SIAGA', 'LIBUR', 'SEDANG_TUGAS');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "driverId" TEXT;

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "licenseNumber" TEXT,
    "routeScope" "DriverRoute" NOT NULL DEFAULT 'DALAM_KOTA',
    "readiness" "DriverReadiness" NOT NULL DEFAULT 'SIAGA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_externalId_key" ON "drivers"("externalId");

-- CreateIndex
CREATE INDEX "drivers_readiness_idx" ON "drivers"("readiness");

-- CreateIndex
CREATE INDEX "drivers_isActive_idx" ON "drivers"("isActive");

-- CreateIndex
CREATE INDEX "bookings_driverId_idx" ON "bookings"("driverId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
