"use server";

import { AttendanceStatus } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { MEAL_TYPES } from "@/lib/attendance/meals";
import { canEditAttendance, isSelectableAttendanceDate } from "@/lib/attendance/rules";
import { parseDateKey, getDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function updateMyAttendanceAction(formData: FormData) {
  const currentUser = await requireUser();
  const parsedDateKey = dateSchema.safeParse(formData.get("date"));

  if (!parsedDateKey.success) {
    redirect("/?error=invalid-date");
  }

  const dateKey = parsedDateKey.data;
  const date = parseDateKey(dateKey);

  if (!date) {
    redirect("/?error=invalid-date");
  }

  if (!isSelectableAttendanceDate(date)) {
    redirect(`/?date=${dateKey}&error=invalid-date`);
  }

  if (!canEditAttendance(date)) {
    redirect(`/?date=${dateKey}&error=deadline`);
  }

  await Promise.all(
    MEAL_TYPES.map((mealType) => {
      const checked = formData.get(`meal:${mealType}`) === "on";

      return prisma.mealAttendance.upsert({
        where: {
          userId_date_mealType: {
            userId: currentUser.id,
            date,
            mealType,
          },
        },
        create: {
          userId: currentUser.id,
          date,
          mealType,
          status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
          generatedFromWeeklyPlan: false,
          manuallyEdited: true,
        },
        update: {
          status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
          generatedFromWeeklyPlan: false,
          manuallyEdited: true,
        },
      });
    }),
  );

  revalidatePath("/");
  redirect(`/?date=${getDateKey(date)}&saved=1`);
}


export async function updateMyMonthlyAttendanceAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetDateValue = formData.get("targetDate");

  const dateEntries = formData.getAll("date");
  const parsedDateEntries = dateEntries
    .map((value) => dateSchema.safeParse(value))
    .filter((result): result is { success: true; data: string } => result.success)
    .map((result) => result.data);

  if (targetDateValue !== null) {
    const parsedTargetDate = dateSchema.safeParse(targetDateValue);

    if (!parsedTargetDate.success) {
      redirect("/?error=invalid-date");
    }

    const targetDateKey = parsedTargetDate.data;
    const date = parseDateKey(targetDateKey);

    if (!date) {
      redirect("/?error=invalid-date");
    }

    if (!isSelectableAttendanceDate(date)) {
      redirect(`/?date=${targetDateKey}&error=invalid-date`);
    }

    if (!canEditAttendance(date)) {
      redirect(`/?date=${targetDateKey}&error=deadline`);
    }

    await prisma.$transaction(
      MEAL_TYPES.map((mealType) => {
        const checked = formData.get(`meal:${targetDateKey}:${mealType}`) === "on";

        return prisma.mealAttendance.upsert({
          where: {
            userId_date_mealType: {
              userId: currentUser.id,
              date,
              mealType,
            },
          },
          create: {
            userId: currentUser.id,
            date,
            mealType,
            status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
          update: {
            status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
        });
      }),
    );

    revalidatePath("/");
    redirect(`/?date=${targetDateKey}&saved=1`);
  }

  if (parsedDateEntries.length === 0) {
    redirect("/?error=invalid-date");
  }

  const uniqueDateKeys = [...new Set(parsedDateEntries)];

  const validatedDates = uniqueDateKeys.map((dateKey) => {
    const date = parseDateKey(dateKey);

    if (!date) {
      redirect("/?error=invalid-date");
    }

    if (!isSelectableAttendanceDate(date)) {
      redirect(`/?date=${dateKey}&error=invalid-date`);
    }

    if (!canEditAttendance(date)) {
      redirect(`/?date=${dateKey}&error=deadline`);
    }

    return { dateKey, date };
  });

  await prisma.$transaction(
    validatedDates.flatMap(({ dateKey, date }) =>
      MEAL_TYPES.map((mealType) => {
        const checked = formData.get(`meal:${dateKey}:${mealType}`) === "on";

        return prisma.mealAttendance.upsert({
          where: {
            userId_date_mealType: {
              userId: currentUser.id,
              date,
              mealType,
            },
          },
          create: {
            userId: currentUser.id,
            date,
            mealType,
            status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
          update: {
            status: checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
        });
      }),
    ),
  );

  revalidatePath("/");
  redirect(`/?date=${validatedDates[0].dateKey}&saved=1`);
}
