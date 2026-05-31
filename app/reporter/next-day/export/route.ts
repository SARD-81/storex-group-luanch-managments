import ExcelJS from "exceljs";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { canAccessReporterPage } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

const COLORS = {
  primaryDark: "FF0F172A",
  secondaryDark: "FF1E293B",
  border: "FFCBD5E1",
  white: "FFFFFFFF",
  light: "FFF8FAFC",
} as const;

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { name: "Tahoma", bold: true, color: { argb: COLORS.white } };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.secondaryDark },
  };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  });
}

function styleDataRow(row: ExcelJS.Row, index: number) {
  row.font = { name: "Tahoma", size: 10 };
  row.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: index % 2 === 0 ? COLORS.white : COLORS.light },
  };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  });
}

function addTitle(worksheet: ExcelJS.Worksheet, title: string, reportDateLabel: string, endColumn: string) {
  worksheet.views = [{ rightToLeft: true, state: "frozen", ySplit: 3 }];
  worksheet.properties.defaultRowHeight = 22;
  worksheet.mergeCells(`A1:${endColumn}1`);
  worksheet.mergeCells(`A2:${endColumn}2`);

  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = {
    name: "Tahoma",
    size: 15,
    bold: true,
    color: { argb: COLORS.white },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primaryDark },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  const subtitleCell = worksheet.getCell("A2");
  subtitleCell.value = `تاریخ گزارش: ${reportDateLabel}`;
  subtitleCell.font = { name: "Tahoma", color: { argb: COLORS.white } };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.secondaryDark },
  };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
}

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canAccessReporterPage(currentUser.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const auditContext = await getAuditRequestContext();
  const report = await getNextDayMealReport();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Storex Lunch Dashboard";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summarySheet = workbook.addWorksheet("خلاصه روز بعد", {
    views: [{ rightToLeft: true }],
  });
  summarySheet.columns = [
    { header: "وعده", key: "meal", width: 18 },
    { header: "پرسنل", key: "employees", width: 14 },
    { header: "مهمان", key: "guests", width: 14 },
    { header: "جمع", key: "total", width: 14 },
  ];
  addTitle(summarySheet, "خلاصه وعده‌های غذایی روز بعد", report.reportDateLabel, "D");
  const summaryHeaderRow = summarySheet.getRow(3);
  summaryHeaderRow.values = ["وعده", "پرسنل", "مهمان", "جمع"];
  styleHeaderRow(summaryHeaderRow);
  report.meals.forEach((meal, index) => {
    const row = summarySheet.addRow({
      meal: meal.mealLabel,
      employees: meal.employeeCount,
      guests: meal.guestCount,
      total: meal.totalCount,
    });
    styleDataRow(row, index);
  });
  const totalRow = summarySheet.addRow({
    meal: "جمع کل",
    employees: report.totals.employeeMeals,
    guests: report.totals.guestMeals,
    total: report.totals.allMeals,
  });
  totalRow.font = { name: "Tahoma", bold: true };
  styleDataRow(totalRow, report.meals.length);

  const employeesSheet = workbook.addWorksheet("پرسنل ثبت‌شده", {
    views: [{ rightToLeft: true }],
  });
  employeesSheet.columns = [
    { header: "وعده", key: "meal", width: 18 },
    { header: "نام پرسنل", key: "name", width: 32 },
  ];
  addTitle(employeesSheet, "پرسنل ثبت‌شده برای وعده‌ها", report.reportDateLabel, "B");
  const employeesHeaderRow = employeesSheet.getRow(3);
  employeesHeaderRow.values = ["وعده", "نام پرسنل"];
  styleHeaderRow(employeesHeaderRow);
  let employeeRowIndex = 0;
  report.meals.forEach((meal) => {
    if (meal.employeeNames.length === 0) {
      const row = employeesSheet.addRow({ meal: meal.mealLabel, name: "—" });
      styleDataRow(row, employeeRowIndex++);
      return;
    }

    meal.employeeNames.forEach((name) => {
      const row = employeesSheet.addRow({ meal: meal.mealLabel, name });
      styleDataRow(row, employeeRowIndex++);
    });
  });

  const guestsSheet = workbook.addWorksheet("مهمان‌ها", {
    views: [{ rightToLeft: true }],
  });
  guestsSheet.columns = [
    { header: "وعده", key: "meal", width: 18 },
    { header: "عنوان", key: "title", width: 28 },
    { header: "نام مهمان", key: "guestName", width: 24 },
    { header: "سازمان", key: "organization", width: 24 },
    { header: "تعداد", key: "count", width: 12 },
    { header: "یادداشت", key: "note", width: 36 },
  ];
  addTitle(guestsSheet, "سفارش‌های مهمان", report.reportDateLabel, "F");
  const guestsHeaderRow = guestsSheet.getRow(3);
  guestsHeaderRow.values = ["وعده", "عنوان", "نام مهمان", "سازمان", "تعداد", "یادداشت"];
  styleHeaderRow(guestsHeaderRow);
  let guestRowIndex = 0;
  report.meals.forEach((meal) => {
    meal.guestOrders.forEach((order) => {
      const row = guestsSheet.addRow({
        meal: meal.mealLabel,
        title: order.title,
        guestName: order.guestName ?? "—",
        organization: order.organization ?? "—",
        count: order.count,
        note: order.note ?? "—",
      });
      styleDataRow(row, guestRowIndex++);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.REPORT_EXPORTED,
    targetType: AuditTargetType.REPORT,
    targetId: null,
    targetLabel: "next-day-meal-report.xlsx",
    status: AuditStatus.SUCCESS,
    metadata: {
      reportDateKey: report.reportDateKey,
      employeeMeals: report.totals.employeeMeals,
      guestMeals: report.totals.guestMeals,
      allMeals: report.totals.allMeals,
    },
    ...auditContext,
  });

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="next-day-meal-report.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
