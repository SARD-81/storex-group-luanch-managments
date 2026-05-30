ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "avatarImage" BYTEA,
ADD COLUMN "avatarMimeType" TEXT,
ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
