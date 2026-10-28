-- Sign in with Google: the Google account (`sub`) linked to a Half Coders account.

-- AlterTable
ALTER TABLE "learning"."user" ADD COLUMN     "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_googleId_key" ON "learning"."user"("googleId");
