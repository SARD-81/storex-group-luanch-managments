import { prisma } from "@/lib/prisma";
import { getCurrentLogo } from "@/lib/branding/logo";
export const dynamic = "force-dynamic";
/** Only current non-sensitive company branding is public, including login. */
export async function GET() {
  const logo = await getCurrentLogo(prisma);
  if (!logo)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
