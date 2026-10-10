import type { NextDayMealReport } from "./next-day-report";
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const number = (n: number) =>
  new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n);
export const REPORT_DOCUMENT_CSS = `
@page { size: A5 portrait; margin: 7mm; }
.meal-report { direction:rtl; background:white; color:black; font-family:var(--font-app),Tahoma,"DejaVu Sans",Arial,sans-serif; width:100%; box-sizing:border-box; font-size:10pt; }
.meal-report header { display:grid; grid-template-columns:1fr 1.4fr 1fr; gap:2mm; align-items:center; margin-bottom:4mm; border-bottom:1px solid black; padding-bottom:3mm; break-inside:avoid; }
.meal-report h2 { font-size:12pt; line-height:1.6; text-align:center; margin:0; }
.meal-report img { display:block; max-width:100%; max-height:17mm; object-fit:contain; }
.meal-report table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:9pt; }
.meal-report th,.meal-report td { border:1px solid black; padding:1.3mm .8mm; overflow-wrap:anywhere; text-align:center; vertical-align:middle; line-height:1.5; }
.meal-report td:nth-child(2),.meal-report td:last-child { text-align:right; }
.meal-report thead { display:table-header-group; }
.meal-report tr { break-inside:avoid; }
.meal-report footer { margin-top:5mm; break-inside:avoid; font-size:9pt; line-height:2; }
.meal-report .total { font-weight:bold; }
@media print {
html,body { background:white!important; margin:0!important; padding:0!important; color:black!important; }
.dashboard-aurora,.reporter-no-print { display:none!important; }
main,.reporter-print-area { position:static!important; width:100%!important; height:auto!important; min-height:0!important; margin:0!important; padding:0!important; border:0!important; background:white!important; box-shadow:none!important; overflow:visible!important; }
main > div { display:block!important; max-width:none!important; margin:0!important; }
.meal-report { max-width:134mm; margin:0 auto; }
}`;
export function reportDocumentMarkup(report: NextDayMealReport, logo?: string) {
  const rows = report.peopleRows.map((r, i) => [
    number(i + 1),
    esc(r.name),
    r.breakfastPresent ? "✓" : "×",
    r.lunchPresent ? "✓" : "×",
    "",
  ]);
  for (let i = 0; i < 4; i++)
    rows.push([number(rows.length + 1), "", "", "", ""]);
  rows.push([
    number(rows.length + 1),
    "مهمان",
    number(report.guestCounts.breakfast),
    number(report.guestCounts.lunch),
    "",
  ]);
  rows.push([
    number(rows.length + 1),
    "جمع کل",
    number(report.totals.breakfastAll),
    number(report.totals.lunchAll),
    "",
  ]);
  return `<article class="meal-report"><header><div>تاریخ گزارش<br><strong>${esc(report.reportDateLabel)}</strong></div><h2>آمار صبحانه، ناهار بهاران</h2><div>${logo ? `<img src="${esc(logo)}" alt="لوگوی بهاران">` : "لوگوی بهاران"}</div></header>
    <table><colgroup><col style="width:8%"><col style="width:40%"><col style="width:12%"><col style="width:12%"><col style="width:28%"></colgroup><thead><tr>${["ردیف", "نام و نام خانوادگی", "صبحانه", "ناهار", "توضیحات"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === rows.length - 1 ? ' class="total"' : ""}>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <footer>نام و نام خانوادگی مسئول مربوطه: _____________________<br>امضا: _____________________</footer></article>`;
}
export function reportDocumentHtml(
  report: NextDayMealReport,
  logo?: string,
  fontCss = "",
) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${REPORT_DOCUMENT_CSS}${fontCss}</style></head><body>${reportDocumentMarkup(report, logo)}</body></html>`;
}
