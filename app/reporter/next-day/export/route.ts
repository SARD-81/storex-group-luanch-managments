import { existsSync } from "fs";
import path from "path";
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
  border: "FF000000",
  light: "FFF8FAFC",
} as const;

const formalNote =
  "غذای مهمان با ثبت تعداد در سامانه قابل قبول است. هر کارمند و مهمان فقط غذای ثبت‌شده خود را دریافت می‌کند و امکان اضافه کردن غذا در همان روز وجود ندارد.";

type MealReport = Awaited<ReturnType<typeof getNextDayMealReport>>["meals"][number];

function formatDisplayNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function styleRange(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromColumn: number,
  toColumn: number,
  options: Partial<ExcelJS.Style> = {},
) {
  for (let columnNumber = fromColumn; columnNumber <= toColumn; columnNumber += 1) {
    const cell = worksheet.getCell(rowNumber, columnNumber);
    cell.font = { name: "Tahoma", size: 8, ...options.font };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
      ...options.alignment,
    };
    if (options.fill) {
      cell.fill = options.fill;
    }
    applyBorder(cell);
  }
}

function addCompactMealTable(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  breakfastMeal: MealReport,
  lunchMeal: MealReport,
) {
  const headerRow = worksheet.getRow(startRow);
  headerRow.values = [
    "ردیف",
    "پرسنل صبحانه",
    "ردیف مهمان",
    "مهمان صبحانه",
    "ردیف",
    "پرسنل ناهار",
    "ردیف مهمان",
    "مهمان ناهار",
  ];
  headerRow.height = 14;
  styleRange(worksheet, startRow, 1, 8, {
    font: { bold: true, size: 8 },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    },
  });

  const rowCount = Math.max(
    breakfastMeal.employeeNames.length,
    breakfastMeal.guestLabels.length,
    lunchMeal.employeeNames.length,
    lunchMeal.guestLabels.length,
    1,
  );

  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = startRow + index + 1;
    const breakfastEmployee = breakfastMeal.employeeNames[index];
    const breakfastGuest = breakfastMeal.guestLabels[index];
    const lunchEmployee = lunchMeal.employeeNames[index];
    const lunchGuest = lunchMeal.guestLabels[index];
    const row = worksheet.getRow(rowNumber);
    row.values = [
      breakfastEmployee ? formatDisplayNumber(index + 1) : "",
      breakfastEmployee ?? "",
      breakfastGuest ? formatDisplayNumber(index + 1) : "",
      breakfastGuest ?? "",
      lunchEmployee ? formatDisplayNumber(index + 1) : "",
      lunchEmployee ?? "",
      lunchGuest ? formatDisplayNumber(index + 1) : "",
      lunchGuest ?? "",
    ];
    row.height = 14;
    styleRange(worksheet, rowNumber, 1, 8, {
      font: { size: 8 },
      alignment: { horizontal: "right" },
    });
    [1, 3, 5, 7].forEach((columnNumber) => {
      worksheet.getCell(rowNumber, columnNumber).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });
  }

  return startRow + rowCount + 1;
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

  const worksheet = workbook.addWorksheet("فرم تحویل غذا", {
    views: [{ rightToLeft: true }],
    pageSetup: {
      paperSize: 11,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.15,
        right: 0.15,
        top: 0.15,
        bottom: 0.15,
        header: 0,
        footer: 0,
      },
    },
  });
  worksheet.properties.defaultRowHeight = 14;
  worksheet.columns = [
    { key: "breakfastEmployeeIndex", width: 5 },
    { key: "breakfastEmployeeName", width: 20 },
    { key: "breakfastGuestIndex", width: 7 },
    { key: "breakfastGuestLabel", width: 14 },
    { key: "lunchEmployeeIndex", width: 5 },
    { key: "lunchEmployeeName", width: 20 },
    { key: "lunchGuestIndex", width: 7 },
    { key: "lunchGuestLabel", width: 14 },
  ];

  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "فرم تحویل آمار وعده‌های غذایی";
  titleCell.font = { name: "Tahoma", size: 12, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  styleRange(worksheet, 1, 1, 8, { font: { size: 12, bold: true } });
  worksheet.getRow(1).height = 20;

  worksheet.mergeCells("A2:B3");
  worksheet.getCell("A2").value = `تاریخ گزارش: ${report.reportDateLabel}`;
  styleRange(worksheet, 2, 1, 2, { font: { bold: true } });
  styleRange(worksheet, 3, 1, 2, { font: { bold: true } });
  worksheet.getRow(2).height = 16;
  worksheet.getRow(3).height = 16;

  worksheet.mergeCells("G2:H3");
  styleRange(worksheet, 2, 7, 8, { font: { bold: true } });
  styleRange(worksheet, 3, 7, 8, { font: { bold: true } });
  const logoPath = path.join(process.cwd(), "public", "company-logo.png");
  if (existsSync(logoPath)) {
    const logoId = workbook.addImage({
      filename: logoPath,
      extension: "png",
    });
    worksheet.addImage(logoId, {
      tl: { col: 6.15, row: 1.2 },
      ext: { width: 70, height: 35 },
    });
  }

  const breakfastMeal = report.meals.find(
    (meal) => meal.mealType === "BREAKFAST",
  ) as MealReport;
  const lunchMeal = report.meals.find(
    (meal) => meal.mealType === "LUNCH",
  ) as MealReport;

  const nextRow = addCompactMealTable(worksheet, 5, breakfastMeal, lunchMeal);

  const totalsRow = nextRow + 1;
  worksheet.mergeCells(totalsRow, 1, totalsRow, 2);
  worksheet.mergeCells(totalsRow, 3, totalsRow, 5);
  worksheet.mergeCells(totalsRow, 6, totalsRow, 8);
  worksheet.getCell(totalsRow, 1).value = `جمع صبحانه: ${formatDisplayNumber(breakfastMeal.totalCount)}`;
  worksheet.getCell(totalsRow, 3).value = `جمع ناهار: ${formatDisplayNumber(lunchMeal.totalCount)}`;
  worksheet.getCell(totalsRow, 6).value = `جمع کل: ${formatDisplayNumber(report.totals.allMeals)}`;
  styleRange(worksheet, totalsRow, 1, 8, {
    font: { bold: true, size: 8 },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    },
  });
  worksheet.getRow(totalsRow).height = 14;

  const noteRow = totalsRow + 1;
  worksheet.mergeCells(noteRow, 1, noteRow, 8);
  worksheet.getCell(noteRow, 1).value = formalNote;
  styleRange(worksheet, noteRow, 1, 8, {
    font: { bold: true, size: 8 },
    alignment: { horizontal: "right" },
  });
  worksheet.getRow(noteRow).height = 18;

  const signatureRow = noteRow + 1;
  worksheet.mergeCells(signatureRow, 1, signatureRow, 2);
  worksheet.mergeCells(signatureRow, 3, signatureRow, 5);
  worksheet.mergeCells(signatureRow, 6, signatureRow, 8);
  worksheet.getCell(signatureRow, 1).value = "تحویل‌دهنده";
  worksheet.getCell(signatureRow, 3).value = "تحویل‌گیرنده";
  worksheet.getCell(signatureRow, 6).value = "تاریخ و امضا";
  styleRange(worksheet, signatureRow, 1, 8, { font: { bold: true, size: 8 } });
  worksheet.getRow(signatureRow).height = 28;

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
