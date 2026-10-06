import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const artifact = await prisma.automationArtifact.findUnique({
    where: { id },
  });
  if (!artifact) return new Response("فایل یافت نشد", { status: 404 });
  try {
    const root = await realpath(
        path.resolve(process.env.AUTOMATION_SPOOL_DIR ?? ".automation-spool"),
      ),
      file = await realpath(artifact.spoolPath);
    if (!file.startsWith(root + path.sep))
      return new Response("دسترسی نامعتبر", { status: 403 });
    const bytes = await readFile(file);
    if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
      return new Response("checksum نامعتبر", { status: 409 });
    const pdf = artifact.type.endsWith("PDF");
    return new Response(bytes, {
      headers: {
        "Content-Type": pdf
          ? "application/pdf"
          : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${artifact.type.toLowerCase()}-${artifact.sha256.slice(0, 12)}.${pdf ? "pdf" : "json"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("فایل در این سرور در دسترس نیست", { status: 503 });
  }
}
