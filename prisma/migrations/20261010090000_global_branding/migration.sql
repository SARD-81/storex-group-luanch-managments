CREATE TABLE "BrandingAsset" (
 "hash" TEXT PRIMARY KEY, "width" INTEGER NOT NULL, "height" INTEGER NOT NULL,
 "byteSize" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BrandingConfig" (
 "id" TEXT PRIMARY KEY DEFAULT 'singleton', "activeHash" TEXT, "previousHash" TEXT,
 "revision" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BrandingConfig_activeHash_fkey" FOREIGN KEY ("activeHash") REFERENCES "BrandingAsset"("hash") ON DELETE RESTRICT,
 CONSTRAINT "BrandingConfig_previousHash_fkey" FOREIGN KEY ("previousHash") REFERENCES "BrandingAsset"("hash") ON DELETE RESTRICT
);
CREATE TABLE "BrandingAudit" (
 "id" TEXT PRIMARY KEY, "actorUserId" TEXT NOT NULL, "actorUsername" TEXT NOT NULL,
 "actorName" TEXT NOT NULL, "action" TEXT NOT NULL, "fromHash" TEXT, "toHash" TEXT,
 "revision" INTEGER NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BrandingAudit_occurredAt_idx" ON "BrandingAudit"("occurredAt");
