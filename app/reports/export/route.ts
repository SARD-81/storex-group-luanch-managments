import ExcelJS from "exceljs";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { getAttendanceReport } from "@/lib/reports/get-attendance-report";
import { resolveReportDateRange } from "@/lib/reports/report-date-range";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
} as const;

const COLORS = {
  primaryDark: "FF0F172A",
  secondaryDark: "FF1E293B",
  border: "FFCBD5E1",
  borderSoft: "FFE2E8F0",
  successBg: "FFDCFCE7",
  successText: "FF166534",
  mutedBg: "FFF1F5F9",
  mutedText: "FF475569",
  warningBg: "FFFEF3C7",
  warningText: "FF92400E",
  white: "FFFFFFFF",
} as const;

function setWorksheetDefaults(
  worksheet: ExcelJS.Worksheet,
  ySplit: number,
  xSplit = 0,
) {
  worksheet.views = [{ rightToLeft: true, state: "frozen", ySplit, xSplit }];
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
  };
  worksheet.properties.defaultRowHeight = 22;
}

function applyBorders(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.borderSoft } },
      left: { style: "thin", color: { argb: COLORS.borderSoft } },
      bottom: { style: "thin", color: { argb: COLORS.borderSoft } },
      right: { style: "thin", color: { argb: COLORS.borderSoft } },
    };
  });
}

function addSheetTitle(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  endColumn: string,
) {
  worksheet.mergeCells(`A1:${endColumn}1`);
  worksheet.mergeCells(`A2:${endColumn}2`);

  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = {
    name: "Tahoma",
    size: 16,
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
  subtitleCell.value = subtitle;
  subtitleCell.font = {
    name: "Tahoma",
    size: 11,
    color: { argb: COLORS.white },
  };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.secondaryDark },
  };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.getRow(1).height = 32;
  worksheet.getRow(2).height = 26;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = {
    name: "Tahoma",
    size: 11,
    bold: true,
    color: { argb: COLORS.white },
  };
  row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.secondaryDark },
  };
  row.height = 24;
  applyBorders(row);
}

function styleDataRow(row: ExcelJS.Row, rowIndex: number) {
  row.font = { name: "Tahoma", size: 10, color: { argb: "FF0F172A" } };
  row.alignment = { horizontal: "right", vertical: "middle" };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: rowIndex % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC" },
  };
  applyBorders(row);
}

function styleStatusCell(cell: ExcelJS.Cell, status: string) {
  if (status === STATUS_LABELS.PRESENT) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.successBg },
    };
    cell.font = {
      name: "Tahoma",
      size: 10,
      bold: true,
      color: { argb: COLORS.successText },
    };
  } else {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.mutedBg },
    };
    cell.font = { name: "Tahoma", size: 10, color: { argb: COLORS.mutedText } };
  }
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const { searchParams } = new URL(request.url);
  const { fromDate, toDate } = resolveReportDateRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const { dailySummary, userRows } = await getAttendanceReport(
    fromDate,
    toDate,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Storex Lunch Dashboard";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const fromLabel = formatPersianWeekdayDate(fromDate);
  const toLabel = formatPersianWeekdayDate(toDate);
  const reportRangeLabel = `بازه گزارش: از ${fromLabel} تا ${toLabel}`;

  const totalBreakfast = dailySummary.reduce(
    (sum, day) => sum + day.breakfastCount,
    0,
  );
  const totalLunch = dailySummary.reduce((sum, day) => sum + day.lunchCount, 0);
  const totalMeals = totalBreakfast + totalLunch;

  const dashboardSheet = workbook.addWorksheet("داشبورد گزارش", {
    views: [{ rightToLeft: true }],
  });
  setWorksheetDefaults(dashboardSheet, 8);
  dashboardSheet.columns = [
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];
  addSheetTitle(
    dashboardSheet,
    "گزارش حضور وعده‌های غذایی",
    reportRangeLabel,
    "H",
  );

  const kpiCards = [
    { label: "تعداد روزهای کاری", value: dailySummary.length },
    { label: "مجموع صبحانه", value: totalBreakfast },
    { label: "مجموع ناهار", value: totalLunch },
    { label: "مجموع کل وعده‌ها", value: totalMeals },
  ];

  kpiCards.forEach((card, index) => {
    const startCol = index * 2 + 1;
    const valueRange = `${String.fromCharCode(64 + startCol)}4:${String.fromCharCode(65 + startCol)}5`;
    const labelRange = `${String.fromCharCode(64 + startCol)}6:${String.fromCharCode(65 + startCol)}6`;
    dashboardSheet.mergeCells(valueRange);
    dashboardSheet.mergeCells(labelRange);

    const valueCell = dashboardSheet.getCell(
      `${String.fromCharCode(64 + startCol)}4`,
    );
    valueCell.value = card.value;
    valueCell.font = {
      name: "Tahoma",
      size: 24,
      bold: true,
      color: { argb: COLORS.primaryDark },
    };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.warningBg },
    };

    const labelCell = dashboardSheet.getCell(
      `${String.fromCharCode(64 + startCol)}6`,
    );
    labelCell.value = card.label;
    labelCell.font = {
      name: "Tahoma",
      size: 10,
      bold: true,
      color: { argb: COLORS.warningText },
    };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.mutedBg },
    };

    [4, 5, 6].forEach((rowNum) => applyBorders(dashboardSheet.getRow(rowNum)));
  });

  dashboardSheet.mergeCells("A8:H8");
  const noteCell = dashboardSheet.getCell("A8");
  noteCell.value = "این گزارش فقط شامل روزهای کاری شنبه تا چهارشنبه است.";
  noteCell.font = {
    name: "Tahoma",
    size: 10,
    color: { argb: COLORS.mutedText },
  };
  noteCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.mutedBg },
  };
  noteCell.alignment = { horizontal: "right", vertical: "middle" };
  applyBorders(dashboardSheet.getRow(8));

  const summarySheet = workbook.addWorksheet("خلاصه روزانه", {
    views: [{ rightToLeft: true }],
  });
  setWorksheetDefaults(summarySheet, 4);
  summarySheet.columns = [
    { header: "تاریخ جلالی", key: "date", width: 30 },
    { header: "صبحانه حاضر", key: "breakfast", width: 16 },
    { header: "ناهار حاضر", key: "lunch", width: 16 },
    { header: "جمع روز", key: "total", width: 16 },
  ];
  addSheetTitle(summarySheet, "خلاصه روزانه حضور", reportRangeLabel, "D");

  const summaryHeaderRow = summarySheet.getRow(4);
  styleHeaderRow(summaryHeaderRow);
  summaryHeaderRow.eachCell((cell, col) => {
    cell.value = summarySheet.columns[col - 1]?.header as string;
  });

  dailySummary.forEach((row, index) => {
    const dataRow = summarySheet.addRow({
      date: row.persianDateLabel,
      breakfast: row.breakfastCount,
      lunch: row.lunchCount,
      total: row.breakfastCount + row.lunchCount,
    });
    styleDataRow(dataRow, index);
    dataRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    dataRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    dataRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
  });

  const totalRow = summarySheet.addRow({
    date: "جمع کل",
    breakfast: 0,
    lunch: 0,
    total: 0,
  });
  const firstDataRow = 5;
  const lastDataRow = totalRow.number - 1;
  totalRow.getCell(2).value = {
    formula: `SUM(B${firstDataRow}:B${lastDataRow})`,
  };
  totalRow.getCell(3).value = {
    formula: `SUM(C${firstDataRow}:C${lastDataRow})`,
  };
  totalRow.getCell(4).value = {
    formula: `SUM(D${firstDataRow}:D${lastDataRow})`,
  };
  totalRow.font = {
    name: "Tahoma",
    size: 11,
    bold: true,
    color: { argb: COLORS.primaryDark },
  };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.warningBg },
  };
  totalRow.alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
  applyBorders(totalRow);

  summarySheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 4 },
  };

  const detailsSheet = workbook.addWorksheet("جزئیات کاربران", {
    views: [{ rightToLeft: true }],
  });
  setWorksheetDefaults(detailsSheet, 4, 1);
  detailsSheet.columns = [
    { header: "تاریخ جلالی", key: "date", width: 30 },
    { header: "نام", key: "name", width: 24 },
    { header: "نام کاربری", key: "username", width: 22 },
    { header: "صبحانه", key: "breakfast", width: 13 },
    { header: "ناهار", key: "lunch", width: 13 },
  ];
  addSheetTitle(detailsSheet, "جزئیات حضور کاربران", reportRangeLabel, "E");

  const detailHeaderRow = detailsSheet.getRow(4);
  styleHeaderRow(detailHeaderRow);
  detailHeaderRow.eachCell((cell, col) => {
    cell.value = detailsSheet.columns[col - 1]?.header as string;
  });

  userRows.forEach((row, index) => {
    const breakfastLabel = STATUS_LABELS[row.breakfastStatus];
    const lunchLabel = STATUS_LABELS[row.lunchStatus];
    const dataRow = detailsSheet.addRow({
      date: row.persianDateLabel,
      name: row.userName,
      username: row.username,
      breakfast: breakfastLabel,
      lunch: lunchLabel,
    });

    styleDataRow(dataRow, index);
    dataRow.getCell(3).alignment = {
      horizontal: "center",
      vertical: "middle",
      readingOrder: "ltr" as const,
    };
    styleStatusCell(dataRow.getCell(4), breakfastLabel);
    styleStatusCell(dataRow.getCell(5), lunchLabel);
  });

  detailsSheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 5 },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.REPORT_EXPORTED,
    targetType: AuditTargetType.REPORT,
    targetId: null,
    targetLabel: "attendance-report.xlsx",
    status: AuditStatus.SUCCESS,
    metadata: {
      fromDate,
      toDate,
      dailySummaryCount: dailySummary.length,
      userRowsCount: userRows.length,
      totalBreakfast,
      totalLunch,
      totalMeals,
      filename: "attendance-report.xlsx",
    },
    ...auditContext,
  });

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance-report.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
