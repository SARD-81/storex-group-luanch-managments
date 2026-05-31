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
  header: "FFE2E8F0",
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
    cell.font = { name: "Tahoma", size: 10, ...options.font };
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

function addMealSection(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  meal: MealReport,
) {
  worksheet.mergeCells(startRow, 1, startRow, 4);
  const titleCell = worksheet.getCell(startRow, 1);
  titleCell.value = meal.mealLabel;
  styleRange(worksheet, startRow, 1, 4, {
    font: { bold: true, size: 12 },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.header },
    },
  });

  const headerRowNumber = startRow + 1;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = [
    "ردیف",
    "نام و نام خانوادگی پرسنل",
    "ردیف مهمان",
    "مهمان",
  ];
  styleRange(worksheet, headerRowNumber, 1, 4, {
    font: { bold: true },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    },
  });

  const rowCount = Math.max(meal.employeeNames.length, meal.guestLabels.length, 1);
  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = headerRowNumber + index + 1;
    const row = worksheet.getRow(rowNumber);
    row.values = [
      meal.employeeNames[index] ? formatDisplayNumber(index + 1) : "",
      meal.employeeNames[index] ?? "",
      meal.guestLabels[index] ? formatDisplayNumber(index + 1) : "",
      meal.guestLabels[index] ?? "",
    ];
    styleRange(worksheet, rowNumber, 1, 4, {
      alignment: { horizontal: "right" },
    });
    worksheet.getCell(rowNumber, 1).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(rowNumber, 3).alignment = { horizontal: "center", vertical: "middle" };
  }

  const totalRowNumber = headerRowNumber + rowCount + 1;
  worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 4);
  const totalCell = worksheet.getCell(totalRowNumber, 1);
  totalCell.value = `جمع کل ${meal.mealLabel} = ${formatDisplayNumber(meal.totalCount)}`;
  styleRange(worksheet, totalRowNumber, 1, 4, {
    font: { bold: true },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    },
  });

  return totalRowNumber + 2;
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
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });
  worksheet.properties.defaultRowHeight = 24;
  worksheet.columns = [
    { key: "employeeIndex", width: 12 },
    { key: "employeeName", width: 38 },
    { key: "guestIndex", width: 14 },
    { key: "guestLabel", width: 30 },
  ];

  worksheet.mergeCells("A1:D1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "فرم تحویل آمار وعده‌های غذایی";
  titleCell.font = { name: "Tahoma", size: 16, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  applyBorder(titleCell);
  worksheet.getRow(1).height = 36;

  worksheet.mergeCells("A2:B2");
  worksheet.getCell("A2").value = `تاریخ گزارش: ${report.reportDateLabel}`;
  styleRange(worksheet, 2, 1, 2, { font: { bold: true } });

  worksheet.mergeCells("C2:D4");
  styleRange(worksheet, 2, 3, 4, { font: { bold: true } });
  styleRange(worksheet, 3, 3, 4, { font: { bold: true } });
  styleRange(worksheet, 4, 3, 4, { font: { bold: true } });
  const logoPath = path.join(process.cwd(), "public", "company-logo.png");
  if (existsSync(logoPath)) {
    const logoId = workbook.addImage({
      filename: logoPath,
      extension: "png",
    });
    worksheet.addImage(logoId, {
      tl: { col: 2.2, row: 1.2 },
      ext: { width: 140, height: 70 },
    });
  }

  const breakfastMeal = report.meals.find(
    (meal) => meal.mealType === "BREAKFAST",
  ) as MealReport;
  const lunchMeal = report.meals.find(
    (meal) => meal.mealType === "LUNCH",
  ) as MealReport;

  let nextRow = addMealSection(worksheet, 6, breakfastMeal);
  nextRow = addMealSection(worksheet, nextRow, lunchMeal);

  const totalsHeaderRow = nextRow;
  const totalsValueRow = nextRow + 1;
  const totals = [
    "جمع کل صبحانه",
    "جمع کل ناهار",
    "جمع کل وعده‌ها",
    "",
  ];
  worksheet.getRow(totalsHeaderRow).values = totals;
  styleRange(worksheet, totalsHeaderRow, 1, 3, {
    font: { bold: true },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.header },
    },
  });
  worksheet.getRow(totalsValueRow).values = [
    formatDisplayNumber(breakfastMeal.totalCount),
    formatDisplayNumber(lunchMeal.totalCount),
    formatDisplayNumber(report.totals.allMeals),
  ];
  styleRange(worksheet, totalsValueRow, 1, 3, { font: { bold: true } });

  const noteRow = totalsValueRow + 2;
  worksheet.mergeCells(noteRow, 1, noteRow, 4);
  worksheet.getCell(noteRow, 1).value = formalNote;
  styleRange(worksheet, noteRow, 1, 4, {
    font: { bold: true },
    alignment: { horizontal: "right" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    },
  });
  worksheet.getRow(noteRow).height = 44;

  const signatureRow = noteRow + 2;
  worksheet.getRow(signatureRow).values = [
    "تحویل‌دهنده",
    "تحویل‌گیرنده",
    "تاریخ و امضا",
  ];
  styleRange(worksheet, signatureRow, 1, 3, { font: { bold: true } });
  worksheet.getRow(signatureRow).height = 58;

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
