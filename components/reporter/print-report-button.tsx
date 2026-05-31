"use client";

export function PrintReportButton() {
  return (
    <button
      type="button"
      className="dashboard-action-button reporter-no-print"
      onClick={() => window.print()}
    >
      چاپ / ذخیره PDF
    </button>
  );
}
