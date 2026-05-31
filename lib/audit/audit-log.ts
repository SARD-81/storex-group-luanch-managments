import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@/app/generated/prisma/client";

import { sanitizeAuditValue } from "./sanitize";

export type AuditActor = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};

export type WriteAuditLogInput = {
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorName?: string | null;
  actorRole?: UserRole | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  status?: AuditStatus;
  requestMethod?: string | null;
  requestPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export function getAuditActorFromUser(
  user: AuditActor | null | undefined,
): Pick<
  WriteAuditLogInput,
  "actorUserId" | "actorUsername" | "actorName" | "actorRole"
> {
  return {
    actorUserId: user?.id ?? null,
    actorUsername: user?.username ?? null,
    actorName: user?.name ?? null,
    actorRole: user?.role ?? null,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  db: PrismaClient | Prisma.TransactionClient,
  input: WriteAuditLogInput,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorUsername: input.actorUsername ?? null,
        actorName: input.actorName ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        status: input.status ?? AuditStatus.SUCCESS,
        requestMethod: input.requestMethod ?? null,
        requestPath: input.requestPath ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        before: toPrismaJson(sanitizeAuditValue(input.before)),
        after: toPrismaJson(sanitizeAuditValue(input.after)),
        metadata: toPrismaJson(sanitizeAuditValue(input.metadata)),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}
