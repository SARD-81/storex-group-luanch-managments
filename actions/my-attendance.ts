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

  if (!parsedDateKey.success) redirect("/?error=invalid-date");
  const dateKey = parsedDateKey.data;
  const date = parseDateKey(dateKey);

  if (!date) redirect("/?error=invalid-date");
  if (!isSelectableAttendanceDate(date)) redirect(`/?date=${dateKey}&error=invalid-date`);
  if (!canEditAttendance(date)) redirect(`/?date=${dateKey}&error=deadline`);

  // گرفتن دیتای موجود از دیتابیس برای مقایسه
  const existingRecords = await prisma.mealAttendance.findMany({
    where: { userId: currentUser.id, date },
    select: { mealType: true, status: true },
  });

  const existingMap = new Map<string, AttendanceStatus>();
  for (const record of existingRecords) {
    existingMap.set(record.mealType, record.status);
  }

  const mutations = [];
  for (const mealType of MEAL_TYPES) {
    const checked = formData.get(`meal:${mealType}`) === "on";
    const newStatus = checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;
    const existingStatus = existingMap.get(mealType);

    // Validation: فقط در صورتی رکورد آپدیت می‌شود که تغییر وضعیتی وجود داشته باشد
    if (existingStatus !== newStatus) {
      mutations.push(
        prisma.mealAttendance.upsert({
          where: { userId_date_mealType: { userId: currentUser.id, date, mealType } },
          create: {
            userId: currentUser.id,
            date,
            mealType,
            status: newStatus,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
          update: {
            status: newStatus,
            generatedFromWeeklyPlan: false,
            manuallyEdited: true,
          },
        })
      );
    }
  }

  // اجرا فقط در صورتی که دیتایی برای تغییر وجود داشته باشد
  if (mutations.length > 0) {
    await prisma.$transaction(mutations);
  }

  revalidatePath("/");
  redirect(`/?date=${dateKey}&saved=1`);
}

export async function updateMyMonthlyAttendanceAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetDateValue = formData.get("targetDate");

  const dateEntries = formData.getAll("date");
  const parsedDateEntries = dateEntries
    .map((value) => dateSchema.safeParse(value))
    .filter((result): result is { success: true; data: string } => result.success)
    .map((result) => result.data);

  let processDates: { dateKey: string; date: Date }[] = [];

  // بررسی اینکه فرم برای یک روز ارسال شده یا کل ماه
  if (targetDateValue !== null) {
    const parsedTargetDate = dateSchema.safeParse(targetDateValue);
    if (!parsedTargetDate.success) redirect("/?error=invalid-date");

    const targetDateKey = parsedTargetDate.data;
    const date = parseDateKey(targetDateKey);
    if (!date) redirect("/?error=invalid-date");
    if (!isSelectableAttendanceDate(date)) redirect(`/?date=${targetDateKey}&error=invalid-date`);
    if (!canEditAttendance(date)) redirect(`/?date=${targetDateKey}&error=deadline`);

    processDates = [{ dateKey: targetDateKey, date }];
  } else {
    if (parsedDateEntries.length === 0) redirect("/?error=invalid-date");

    const uniqueDateKeys = [...new Set(parsedDateEntries)];
    processDates = uniqueDateKeys.map((dateKey) => {
      const date = parseDateKey(dateKey);
      if (!date) redirect("/?error=invalid-date");
      if (!isSelectableAttendanceDate(date)) redirect(`/?date=${dateKey}&error=invalid-date`);
      if (!canEditAttendance(date)) redirect(`/?date=${dateKey}&error=deadline`);
      return { dateKey, date };
    });
  }

  // ۱. واکشی اطلاعات تمام روزهای مورد نیاز با یک کوئری سریع
  const existingRecords = await prisma.mealAttendance.findMany({
    where: {
      userId: currentUser.id,
      date: { in: processDates.map((d) => d.date) },
    },
    select: { date: true, mealType: true, status: true },
  });

  const existingMap = new Map<string, AttendanceStatus>();
  for (const record of existingRecords) {
    existingMap.set(`${getDateKey(record.date)}-${record.mealType}`, record.status);
  }

  // ۲. پیدا کردن رکوردهایی که کاربر در فرم تغییر داده است
  const mutations = [];

  for (const { dateKey, date } of processDates) {
    for (const mealType of MEAL_TYPES) {
      const checked = formData.get(`meal:${dateKey}:${mealType}`) === "on";
      const newStatus = checked ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;
      const existingStatus = existingMap.get(`${dateKey}-${mealType}`);

      // Validation: در صورت تکراری بودن تغییری انجام نمی‌شود
      if (existingStatus !== newStatus) {
        mutations.push(
          prisma.mealAttendance.upsert({
            where: {
              userId_date_mealType: { userId: currentUser.id, date, mealType },
            },
            create: {
              userId: currentUser.id,
              date,
              mealType,
              status: newStatus,
              generatedFromWeeklyPlan: false,
              manuallyEdited: true,
            },
            update: {
              status: newStatus,
              generatedFromWeeklyPlan: false,
              manuallyEdited: true,
            },
          })
        );
      }
    }
  }

  // ۳. ثبت تراکنش در دیتابیس (فقط اگر تغییری صورت گرفته باشد)
  if (mutations.length > 0) {
    await prisma.$transaction(mutations);
  }

  revalidatePath("/");
  redirect(`/?date=${processDates[0].dateKey}&saved=1`);
}