"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { WORK_DAYS } from "@/lib/attendance/week";
import { MEAL_TYPES } from "@/lib/attendance/meals";

export async function updateWeeklyPreferencesAction(formData: FormData) {
  await requireAdmin();

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const operations = users.flatMap((user) =>
    WORK_DAYS.flatMap((day) =>
      MEAL_TYPES.map((mealType) => {
        const key = `preference:${user.id}:${day.dayOfWeek}:${mealType}`;
        const isEnabled = formData.has(key);

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

  revalidatePath("/");
  revalidatePath("/settings/weekly-plan");

  redirect("/settings/weekly-plan?saved=1");
}
