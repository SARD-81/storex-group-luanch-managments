import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
  type Prisma,
} from "@/app/generated/prisma/client";
import AuditLogFilterPanel from "@/components/audit/audit-log-filter-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SENSITIVE_KEYS = new Set([
  "passwordHash",
  "tokenHash",
  "sessionTokenHash",
  "avatarImage",
  "avatarBinary",
  "avatarData",
]);

const auditDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Tehran",
});

const actionLabels: Partial<Record<AuditAction, string>> = {
  [AuditAction.LOGIN_SUCCESS]: "ورود موفق",
  [AuditAction.LOGIN_FAILURE]: "ورود ناموفق",
  [AuditAction.LOGOUT]: "خروج از حساب",
  [AuditAction.USER_CREATED]: "ایجاد کاربر",
  [AuditAction.USER_STATUS_CHANGED]: "تغییر وضعیت کاربر",
  [AuditAction.USER_PASSWORD_RESET]: "بازنشانی رمز عبور",
  [AuditAction.PROFILE_UPDATED]: "به‌روزرسانی پروفایل",
  [AuditAction.MY_PASSWORD_CHANGED]: "تغییر رمز عبور",
  [AuditAction.AVATAR_UPDATED]: "به‌روزرسانی تصویر پروفایل",
  [AuditAction.AVATAR_DELETED]: "حذف تصویر پروفایل",
  [AuditAction.ATTENDANCE_UPDATED]: "به‌روزرسانی حضور",
  [AuditAction.MONTHLY_ATTENDANCE_UPDATED]: "به‌روزرسانی حضور ماهانه",
  [AuditAction.WEEKLY_ATTENDANCE_GENERATED]: "ایجاد برنامه حضور هفتگی",
  [AuditAction.WEEKLY_PREFERENCES_UPDATED]: "به‌روزرسانی ترجیحات هفتگی",
  [AuditAction.CALENDAR_OVERRIDE_FORCE_HOLIDAY]: "ثبت تعطیلی دستی",
  [AuditAction.CALENDAR_OVERRIDE_FORCE_WORKDAY]: "ثبت روز کاری اجباری",
  [AuditAction.CALENDAR_OVERRIDE_CLEARED]: "پاک‌کردن تغییر تقویم",
  [AuditAction.REPORT_EXPORTED]: "خروجی گزارش",
};

const statusLabels: Record<AuditStatus, string> = {
  [AuditStatus.SUCCESS]: "موفق",
  [AuditStatus.FAILURE]: "ناموفق",
  [AuditStatus.DENIED]: "رد شده",
};

type SearchParams = Promise<{
  action?: string;
  targetType?: string;
  status?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

function isAuditAction(value: string | undefined): value is AuditAction {
  return Object.values(AuditAction).includes(value as AuditAction);
}

function isAuditTargetType(
  value: string | undefined,
): value is AuditTargetType {
  return Object.values(AuditTargetType).includes(value as AuditTargetType);
}

function isAuditStatus(value: string | undefined): value is AuditStatus {
  return Object.values(AuditStatus).includes(value as AuditStatus);
}

function parseDateParts(value: string | undefined) {
  if (!value || !DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseDateStart(value: string | undefined): Date | null {
  const parts = parseDateParts(value);

  if (!parts) {
    return null;
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
}

function parseDateEnd(value: string | undefined): Date | null {
  const parts = parseDateParts(value);

  if (!parts) {
    return null;
  }

  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999),
  );
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key) ? "[redacted]" : redactSensitiveValue(item),
      ]),
    );
  }

  return value;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return JSON.stringify(redactSensitiveValue(value), null, 2);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

function formatAuditDate(date: Date): string {
  return auditDateFormatter.format(date);
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  noStore();

  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const actor = params.actor?.trim() ?? "";
  const from = parseDateStart(params.from);
  const to = parseDateEnd(params.to);
  const where: Prisma.AuditLogWhereInput = {};

  if (isAuditAction(params.action)) {
    where.action = params.action;
  }

  if (isAuditTargetType(params.targetType)) {
    where.targetType = params.targetType;
  }

  if (isAuditStatus(params.status)) {
    where.status = params.status;
  }

  if (actor) {
    where.OR = [
      { actorUsername: { contains: actor, mode: "insensitive" } },
      { actorName: { contains: actor, mode: "insensitive" } },
    ];
  }

  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        occurredAt: true,
        actorUsername: true,
        actorName: true,
        actorRole: true,
        action: true,
        targetType: true,
        targetId: true,
        targetLabel: true,
        status: true,
        requestMethod: true,
        requestPath: true,
        ipAddress: true,
        userAgent: true,
        before: true,
        after: true,
        metadata: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buildPageHref = (nextPage: number) => {
    const query = new URLSearchParams();

    for (const key of [
      "action",
      "targetType",
      "status",
      "actor",
      "from",
      "to",
    ] as const) {
      const value = params[key];

      if (value) {
        query.set(key, value);
      }
    }

    query.set("page", String(nextPage));

    return `/settings/audit-logs?${query.toString()}`;
  };

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                مشاهده رخدادهای امنیتی و عملیاتی ثبت‌شده در سامانه
              </p>
              <h1 className="mt-1 text-3xl font-bold">لاگ ممیزی سامانه</h1>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="dashboard-action-button inline-flex items-center gap-2"
            >
              بازگشت به داشبورد
            </Link>
            <Link
              href="/settings/users"
              className="dashboard-action-button inline-flex items-center gap-2"
            >
              مدیریت کاربران
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="dashboard-muted-panel">
            <p className="text-xs text-muted-foreground">کل لاگ‌ها</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {totalCount}
            </p>
          </div>
          <div className="dashboard-muted-panel">
            <p className="text-xs text-muted-foreground">صفحه جاری</p>
            <p className="mt-1 text-2xl font-bold text-sky-700 dark:text-sky-200">
              {page}
            </p>
          </div>
          <div className="dashboard-muted-panel">
            <p className="text-xs text-muted-foreground">کل صفحات</p>
            <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-200">
              {totalPages}
            </p>
          </div>
        </section>

        <AuditLogFilterPanel
          action={params.action}
          targetType={params.targetType}
          status={params.status}
          actor={params.actor}
          from={params.from}
          to={params.to}
        />

        <section className="dashboard-glass-card relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">لیست رخدادها</h2>
            <p className="text-xs text-muted-foreground">
              هر صفحه {PAGE_SIZE} لاگ را نمایش می‌دهد.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-muted/60 text-foreground">
                  <th className="border-b border-border/60 p-3 text-right">
                    زمان
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    کاربر
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    عملیات
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    هدف
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    وضعیت
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    مسیر/IP
                  </th>
                  <th className="border-b border-border/60 p-3 text-right">
                    جزئیات
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-b border-border/60 p-6 text-center text-muted-foreground"
                    >
                      هیچ لاگی با این فیلترها پیدا نشد.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="odd:bg-muted/30 align-top">
                      <td className="border-b border-border/60 p-3 whitespace-nowrap">
                        {formatAuditDate(log.occurredAt)}
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <p className="font-semibold text-foreground">
                          {log.actorName ?? "کاربر نامشخص"}
                        </p>
                        {log.actorUsername ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            @{log.actorUsername}
                          </p>
                        ) : null}
                        {log.actorRole ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {log.actorRole}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <p className="font-semibold text-foreground">
                          {actionLabels[log.action] ?? log.action}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.action}
                        </p>
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <p className="font-semibold text-foreground">
                          {log.targetLabel ?? log.targetId ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.targetType}
                        </p>
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <span className="inline-flex rounded-full bg-muted/70 px-2.5 py-1 text-xs font-semibold text-foreground">
                          {statusLabels[log.status]}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.status}
                        </p>
                      </td>
                      <td className="border-b border-border/60 p-3">
                        {log.requestMethod || log.requestPath ? (
                          <p className="break-words text-foreground">
                            {[log.requestMethod, log.requestPath]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">—</p>
                        )}
                        {log.ipAddress ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {log.ipAddress}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <details className="group max-w-md">
                          <summary className="cursor-pointer text-sm font-semibold text-sky-700 transition hover:text-sky-600 dark:text-sky-200 dark:hover:text-sky-100">
                            مشاهده
                          </summary>
                          <div className="mt-3 space-y-3 text-xs">
                            <div>
                              <p className="mb-1 font-semibold text-muted-foreground">
                                قبل
                              </p>
                              <pre className="dashboard-muted-panel whitespace-pre-wrap break-words p-3 text-left text-xs">
                                {formatJson(log.before)}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-muted-foreground">
                                بعد
                              </p>
                              <pre className="dashboard-muted-panel whitespace-pre-wrap break-words p-3 text-left text-xs">
                                {formatJson(log.after)}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-muted-foreground">
                                متادیتا
                              </p>
                              <pre className="dashboard-muted-panel whitespace-pre-wrap break-words p-3 text-left text-xs">
                                {formatJson(log.metadata)}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-muted-foreground">
                                User-Agent
                              </p>
                              <pre className="dashboard-muted-panel whitespace-pre-wrap break-words p-3 text-left text-xs">
                                {log.userAgent
                                  ? truncateText(log.userAgent, 160)
                                  : "—"}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {page <= 1 ? (
              <span className="dashboard-muted-panel cursor-not-allowed opacity-50">
                صفحه قبلی
              </span>
            ) : (
              <Link
                href={buildPageHref(page - 1)}
                className="dashboard-action-button"
              >
                صفحه قبلی
              </Link>
            )}
            <span className="text-muted-foreground">
              صفحه {page} از {totalPages}
            </span>
            {page >= totalPages ? (
              <span className="dashboard-muted-panel cursor-not-allowed opacity-50">
                صفحه بعدی
              </span>
            ) : (
              <Link
                href={buildPageHref(page + 1)}
                className="dashboard-action-button"
              >
                صفحه بعدی
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
