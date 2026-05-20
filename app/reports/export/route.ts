import { requireAdmin } from "@/lib/auth/session";
import { getAttendanceReport } from "@/lib/reports/get-attendance-report";
import { resolveReportDateRange } from "@/lib/reports/report-date-range";

const STATUS_LABELS = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
} as const;

function escapeCsv(value: string) {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export async function GET(request: Request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const { fromDate, toDate } = resolveReportDateRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const { userRows } = await getAttendanceReport(fromDate, toDate);

  const header = ["dateKey", "persianDateLabel", "userName", "username", "breakfastStatus", "lunchStatus"];
  const lines = [
    header.join(","),
    ...userRows.map((row) =>
      [
        row.dateKey,
        row.persianDateLabel,
        row.userName,
        row.username,
        STATUS_LABELS[row.breakfastStatus],
        STATUS_LABELS[row.lunchStatus],
      ]
        .map((field) => escapeCsv(field))
        .join(","),
    ),
  ];

  const csv = `\uFEFF${lines.join("\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-report.csv"',
    },
  });
}
