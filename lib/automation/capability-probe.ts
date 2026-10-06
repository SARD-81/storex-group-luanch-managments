import { createHash } from "node:crypto";
import type {
  AutomationConfig,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { getTehranDateKey } from "@/lib/date/tehran-time";
import { NextcloudClient } from "./integrations";
// A valid, public-safe PDF containing no business data; no renderer/network dependency.
export function probePdf() {
  const body =
    "BT /F1 12 Tf 20 80 Td (Automation capability probe - no business data) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  for (const [i, o] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export async function verifiedCapabilityProbe(
  db: PrismaClient,
  config: AutomationConfig,
  cloud: NextcloudClient,
  now: Date,
) {
  const key = `capability:${getTehranDateKey(now)}`;
  let lease = await db.automationShareLease.upsert({
    where: { leaseKey: key },
    create: {
      leaseKey: key,
      nextcloudPath: `${config.reportsDirectory}/.capability/${getTehranDateKey(now)}.pdf`,
    },
    update: {},
  });
  if (lease.revokedAt) return; // Today's anonymous probe was already verified and removed.
  const bytes = probePdf();
  await cloud.upload(lease.nextcloudPath, bytes, "application/pdf");
  if (!lease.shareId) {
    const share = await cloud.getOrCreateShare(lease.nextcloudPath, now);
    lease = await db.automationShareLease.update({
      where: { id: lease.id },
      data: {
        shareId: share.id,
        publicUrl: share.url,
        shareCreatedAt: share.createdAt,
        expiresAt: new Date(share.createdAt.getTime() + 86400000),
      },
    });
  }
  await cloud.verifyPublic(
    lease.publicUrl!,
    createHash("sha256").update(bytes).digest("hex"),
  );
  await cloud.revokeShare(lease.shareId!);
  await db.automationShareLease.update({
    where: { id: lease.id },
    data: { revokedAt: now, cleanupError: null },
  });
  // Only the probe's private file is deleted. Report PDFs are retained.
  await cloud.deleteFile(lease.nextcloudPath);
}
