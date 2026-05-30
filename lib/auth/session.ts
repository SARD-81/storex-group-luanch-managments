import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "meal_dashboard_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getSessionCookieTokens() {
  const cookieStore = await cookies();
  return [
    ...new Set(
      cookieStore
        .getAll(SESSION_COOKIE_NAME)
        .map((cookie) => cookie.value)
        .filter(Boolean),
    ),
  ];
}

export async function createSession(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const sessionTokens = await getSessionCookieTokens();

  if (sessionTokens.length === 0) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: {
        in: sessionTokens.map(sha256),
      },
      expiresAt: {
        gt: new Date(),
      },
      user: {
        isActive: true,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return user;
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const sessionTokens = await getSessionCookieTokens();

  if (sessionTokens.length > 0) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: {
          in: sessionTokens.map(sha256),
        },
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
