export function ReporterPrintPageStyle() {
  return (
    <style>{`
      @media print {
        @page {
          size: A5 landscape;
          margin: 0;
        }

        html,
        body {
          width: 210mm !important;
          min-height: 148mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        .reporter-print-area {
          position: fixed !important;
          inset: 0 !important;
          width: 210mm !important;
          height: 148mm !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }

        .reporter-next-day-paper {
          width: 210mm !important;
          height: 148mm !important;
          margin: 0 !important;
          padding: 4mm !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }

        .reporter-next-day-header {
          min-height: 15mm !important;
          padding: 1mm 30mm !important;
          border-bottom: 1px solid #000000 !important;
        }

        .reporter-next-day-header__title h2,
        .reporter-print-title h2 {
          font-size: 11pt !important;
          line-height: 1.2 !important;
        }

        .reporter-next-day-header__date,
        .reporter-print-date {
          width: 32mm !important;
          font-size: 7pt !important;
          line-height: 1.2 !important;
        }

        .reporter-next-day-header__date strong,
        .reporter-print-date strong {
          font-size: 7.5pt !important;
        }

        .reporter-next-day-header__logo,
        .reporter-print-logo {
          width: 27mm !important;
          flex-basis: 27mm !important;
        }

        .reporter-next-day-header__logo img,
        .reporter-print-logo img,
        .reporter-next-day-logo-placeholder {
          max-height: 13mm !important;
          min-height: 13mm !important;
        }

        .reporter-next-day-table,
        .reporter-print-table {
          margin-top: 2mm !important;
          font-size: 6.8pt !important;
          line-height: 1 !important;
        }

        .reporter-next-day-table th,
        .reporter-next-day-table td,
        .reporter-print-table th,
        .reporter-print-table td {
          padding: 0.35mm 0.6mm !important;
        }

        .reporter-next-day-table tbody tr,
        .reporter-print-table tbody tr {
          height: 4.4mm !important;
        }

        .reporter-next-day-footer,
        .reporter-print-footer {
          margin-top: 2mm !important;
          font-size: 7.5pt !important;
        }
      }
    `}</style>
  );
}
