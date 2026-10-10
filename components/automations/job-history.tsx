import type { AutomationJobRun } from "@/app/generated/prisma/client";
import { retryAutomationJobAction } from "@/actions/automations";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import { JOB_LABELS, STATUS_LABELS } from "./admin-shell";
export function JobHistory({ jobs }: { jobs: AutomationJobRun[] }) {
  return (
    <section className="dashboard-glass-card">
      <h2 className="mb-3 text-lg font-bold">تاریخچهٔ اجرا</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr>
              {[
                "کار / هدف",
                "وضعیت / مرحله",
                "تلاش",
                "آخرین اجرا",
                "نوبت بعد / خطا",
                "اقدام",
              ].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="p-2">
                  {JOB_LABELS[j.jobType] ?? j.jobType}
                  <br />
                  {j.target}
                  <details>
                    <summary>شناسه</summary>
                    <code dir="ltr">
                      {j.id}
                      <br />
                      {j.executionKey}
                    </code>
                  </details>
                </td>
                <td className="p-2">
                  {STATUS_LABELS[j.status]}
                  <br />
                  <code>{j.stage}</code>
                </td>
                <td className="p-2">{j.attempt}</td>
                <td className="p-2">
                  {j.startedAt ? formatPersianDateTime(j.startedAt) : "—"}
                </td>
                <td className="p-2">
                  {j.nextRetryAt ? formatPersianDateTime(j.nextRetryAt) : "—"}
                  <br />
                  <code>{j.errorCode}</code>
                </td>
                <td className="p-2">
                  {["FAILED", "RETRYING", "BLOCKED", "SKIPPED"].includes(
                    j.status,
                  ) ? (
                    <form action={retryAutomationJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="dashboard-action-button">
                        تلاش مجدد
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobs.length === 0 ? <p>هنوز اجرایی ثبت نشده است.</p> : null}
    </section>
  );
}
