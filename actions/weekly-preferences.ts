"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { WORK_DAYS } from "@/lib/attendance/week";
import { MEAL_TYPES } from "@/lib/attendance/meals";

type WeeklyPreferenceAuditChange = {
  userId: string;
  username: string;
  name: string;
  dayOfWeek: number;
  mealType: (typeof MEAL_TYPES)[number];
  beforeIsEnabled: boolean;
  afterIsEnabled: boolean;
};

export async function updateWeeklyPreferencesAction(formData: FormData) {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
    },
  });

  const existingPreferences = await prisma.weeklyMealPreference.findMany({
    where: {
      userId: { in: users.map((user) => user.id) },
    },
    select: {
      userId: true,
      dayOfWeek: true,
      mealType: true,
      isEnabled: true,
    },
  });

  const existingPreferenceMap = new Map<string, boolean>();
  for (const preference of existingPreferences) {
    existingPreferenceMap.set(
      `${preference.userId}:${preference.dayOfWeek}:${preference.mealType}`,
      preference.isEnabled,
    );
  }

  const auditChanges: WeeklyPreferenceAuditChange[] = [];

  const operations = users.flatMap((user) =>
    WORK_DAYS.flatMap((day) =>
      MEAL_TYPES.map((mealType) => {
        const preferenceKey = `${user.id}:${day.dayOfWeek}:${mealType}`;
        const formKey = `preference:${user.id}:${day.dayOfWeek}:${mealType}`;
        const previousIsEnabled = existingPreferenceMap.get(preferenceKey) ?? false;
        const isEnabled = formData.has(formKey);

        if (previousIsEnabled !== isEnabled) {
          auditChanges.push({
            userId: user.id,
            username: user.username,
            name: user.name,
            dayOfWeek: day.dayOfWeek,
            mealType,
            beforeIsEnabled: previousIsEnabled,
            afterIsEnabled: isEnabled,
          });
        }

        return prisma.weeklyMealPreference.upsert({
          where: {
            userId_dayOfWeek_mealType: {
              userId: user.id,
              dayOfWeek: day.dayOfWeek,
              mealType,
            },
          },
          update: {
            isEnabled,
          },
          create: {
            userId: user.id,
            dayOfWeek: day.dayOfWeek,
            mealType,
            isEnabled,
          },
        });
      }),
    ),
  );

  await prisma.$transaction(operations);

  if (auditChanges.length > 0) {
    await writeAuditLog(prisma, {
      ...getAuditActorFromUser(admin),
      action: AuditAction.WEEKLY_PREFERENCES_UPDATED,
      targetType: AuditTargetType.WEEKLY_MEAL_PREFERENCE,
      targetId: null,
      targetLabel: "weekly-preferences",
      status: AuditStatus.SUCCESS,
      metadata: {
        changedCount: auditChanges.length,
        affectedUserCount: new Set(
          auditChanges.map((change) => change.userId),
        ).size,
        changes: auditChanges,
      },
      ...auditContext,
    });
  }

  revalidatePath("/");
  revalidatePath("/settings/weekly-plan");

  redirect("/settings/weekly-plan?saved=1");
}
