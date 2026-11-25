-- Sign-in history, so an admin can see where a student's account is used
-- from — each device, address and place, and every time the device limit
-- turned someone away — and spot an account being shared.
--
-- `sign_in_event` keeps every sign-in for good (a session row goes when its
-- device signs out). `ip_location` caches where an address is, from an IP
-- lookup service. Sessions learn when they were last used, and from where.
--
-- The devices signed in right now are carried over as history, so the list
-- isn't empty on day one; how they signed in wasn't recorded, so their
-- `method` stays null.

-- CreateEnum
CREATE TYPE "learning"."SignInMethod" AS ENUM ('PASSWORD', 'GOOGLE', 'EMAIL_CODE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "learning"."SignInOutcome" AS ENUM ('SIGNED_IN', 'DEVICE_LIMIT_REFUSED');

-- AlterTable
ALTER TABLE "learning"."session" ADD COLUMN     "lastIp" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "learning"."sign_in_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" "learning"."SignInOutcome" NOT NULL,
    "method" "learning"."SignInMethod",
    "sessionId" TEXT,
    "signedOutOthers" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."ip_location" (
    "ip" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "network" TEXT,
    "lookedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_location_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE UNIQUE INDEX "sign_in_event_sessionId_key" ON "learning"."sign_in_event"("sessionId");

-- CreateIndex
CREATE INDEX "sign_in_event_userId_createdAt_idx" ON "learning"."sign_in_event"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "learning"."sign_in_event" ADD CONSTRAINT "sign_in_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the devices signed in right now.
INSERT INTO "learning"."sign_in_event" ("id", "userId", "outcome", "sessionId", "ipAddress", "userAgent", "createdAt")
SELECT gen_random_uuid()::text, "userId", 'SIGNED_IN', "id", "ipAddress", "userAgent", "createdAt"
FROM "learning"."session"
WHERE "expiresAt" > CURRENT_TIMESTAMP;
