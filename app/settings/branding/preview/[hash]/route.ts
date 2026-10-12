import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { readBrandingAsset } from "@/lib/branding/logo";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN")
    return new Response(null, { status: user ? 403 : 401 });
  try {
    const { hash } = await params,
      logo = await readBrandingAsset(prisma, hash);
    return new Response(new Uint8Array(logo.bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
