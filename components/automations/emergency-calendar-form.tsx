"use client";
import { useActionState, type ReactNode } from "react";
import { previewEmergencyCalendarAction } from "@/actions/automations";
export function EmergencyCalendarForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState(
    previewEmergencyCalendarAction,
    { errors: [] },
  );
  return (
    <form action={action} className="space-y-4">
      {state.errors.length ? (
        <div
          role="alert"
          className="dashboard-muted-panel border border-rose-500"
        >
          <p>ورودی را اصلاح کنید:</p>
          <ul>
            {state.errors.slice(0, 30).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {state.errors.length > 30 ? (
            <p>و {state.errors.length - 30} خطای دیگر</p>
          ) : null}
        </div>
      ) : null}
      {children}
      <button disabled={pending} className="dashboard-primary-button">
        {pending ? "در حال بررسی…" : "ساخت پیش‌نمایش و اختلاف‌ها"}
      </button>
    </form>
  );
}
