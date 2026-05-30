import { UserRole } from "@/app/generated/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const currentUser = await requireUser();
  const { userId } = await params;

  if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
    return new Response(null, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarImage: true,
      avatarMimeType: true,
      avatarUpdatedAt: true,
    },
  });

  if (!user?.avatarImage || !user.avatarMimeType) {
    return new Response(null, { status: 404 });
  }

  const etag = `"${user.id}-${user.avatarUpdatedAt?.getTime() ?? "static"}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(user.avatarImage, {
    headers: {
      "Content-Type": user.avatarMimeType,
      "Cache-Control": "private, max-age=3600",
      ETag: etag,
    },
  });
}
