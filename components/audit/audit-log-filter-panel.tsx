"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { getDateKey } from "@/lib/date/date-key";

type AuditLogFilterPanelProps = {
  action?: string;
  targetType?: string;
  status?: string;
  actor?: string;
  from?: string;
  to?: string;
};

type AuditLogFilters = AuditLogFilterPanelProps;

type DropdownOption = {
  value: string;
  label: string;
};

type OpenDropdown = "action" | "targetType" | "status" | null;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const AUDIT_ACTION_VALUES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "USER_CREATED",
  "USER_STATUS_CHANGED",
  "USER_PASSWORD_RESET",
  "PROFILE_UPDATED",
  "MY_PASSWORD_CHANGED",
  "AVATAR_UPDATED",
  "AVATAR_DELETED",
  "ATTENDANCE_UPDATED",
  "MONTHLY_ATTENDANCE_UPDATED",
  "WEEKLY_ATTENDANCE_GENERATED",
  "WEEKLY_PREFERENCES_UPDATED",
  "CALENDAR_OVERRIDE_FORCE_HOLIDAY",
  "CALENDAR_OVERRIDE_FORCE_WORKDAY",
  "CALENDAR_OVERRIDE_CLEARED",
  "REPORT_EXPORTED",
] as const;

const AUDIT_TARGET_TYPE_VALUES = [
  "AUTH",
  "SESSION",
  "USER",
  "PROFILE",
  "AVATAR",
  "MEAL_ATTENDANCE",
  "WEEKLY_MEAL_PREFERENCE",
  "CALENDAR_OVERRIDE",
  "CALENDAR_DAY",
  "REPORT",
  "SYSTEM",
] as const;

const AUDIT_STATUS_VALUES = [
  "SUCCESS",
  "FAILURE",
  "DENIED",
] as const;

type AuditActionValue = (typeof AUDIT_ACTION_VALUES)[number];
type AuditTargetTypeValue = (typeof AUDIT_TARGET_TYPE_VALUES)[number];
type AuditStatusValue = (typeof AUDIT_STATUS_VALUES)[number];

const actionLabels: Record<AuditActionValue, string> = {
  LOGIN_SUCCESS: "ورود موفق",
  LOGIN_FAILURE: "ورود ناموفق",
  LOGOUT: "خروج از حساب",
  USER_CREATED: "ایجاد کاربر",
  USER_STATUS_CHANGED: "تغییر وضعیت کاربر",
  USER_PASSWORD_RESET: "بازنشانی رمز عبور",
  PROFILE_UPDATED: "به‌روزرسانی پروفایل",
  MY_PASSWORD_CHANGED: "تغییر رمز عبور",
  AVATAR_UPDATED: "به‌روزرسانی تصویر پروفایل",
  AVATAR_DELETED: "حذف تصویر پروفایل",
  ATTENDANCE_UPDATED: "به‌روزرسانی حضور",
  MONTHLY_ATTENDANCE_UPDATED: "به‌روزرسانی حضور ماهانه",
  WEEKLY_ATTENDANCE_GENERATED: "ایجاد برنامه حضور هفتگی",
  WEEKLY_PREFERENCES_UPDATED: "به‌روزرسانی ترجیحات هفتگی",
  CALENDAR_OVERRIDE_FORCE_HOLIDAY: "ثبت تعطیلی دستی",
  CALENDAR_OVERRIDE_FORCE_WORKDAY: "ثبت روز کاری اجباری",
  CALENDAR_OVERRIDE_CLEARED: "پاک‌کردن تغییر تقویم",
  REPORT_EXPORTED: "خروجی گزارش",
};

const targetTypeLabels: Record<AuditTargetTypeValue, string> = {
  AUTH: "احراز هویت",
  SESSION: "نشست",
  USER: "کاربر",
  PROFILE: "پروفایل",
  AVATAR: "تصویر پروفایل",
  MEAL_ATTENDANCE: "حضور وعده غذایی",
  WEEKLY_MEAL_PREFERENCE: "برنامه هفتگی",
  CALENDAR_OVERRIDE: "تغییر تقویم",
  CALENDAR_DAY: "روز تقویم",
  REPORT: "گزارش",
  SYSTEM: "سامانه",
};

const statusLabels: Record<AuditStatusValue, string> = {
  SUCCESS: "موفق",
  FAILURE: "ناموفق",
  DENIED: "رد شده",
};

function isValidDateKey(value: string | undefined): boolean {
  if (!value || !DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dateKeyToDateObject(dateKey: string | undefined): DateObject | null {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey!.split("-").map(Number);

  return new DateObject({
    date: new Date(Date.UTC(year, month - 1, day)),
    calendar: persian,
    locale: persianFa,
  });
}

function dateObjectToGregorianDate(value: DateObject): Date {
  const date = value.toDate();

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function buildAuditLogsHref(filters: AuditLogFilters): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    const trimmedValue = value?.trim();

    if (trimmedValue) {
      query.set(key, trimmedValue);
    }
  }

  const queryString = query.toString();

  return `/settings/audit-logs${queryString ? `?${queryString}` : ""}`;
}

function getActionLabel(action: string): string {
  return actionLabels[action as AuditActionValue] ?? action;
}

function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabels[targetType as AuditTargetTypeValue] ?? targetType;
}

function getStatusLabel(status: string): string {
  return statusLabels[status as AuditStatusValue] ?? status;
}

function FilterDropdown({
  id,
  title,
  value,
  options,
  isOpen,
  disabled,
  onOpenChange,
  onChange,
}: {
  id: Exclude<OpenDropdown, null>;
  title: string;
  value: string;
  options: DropdownOption[];
  isOpen: boolean;
  disabled: boolean;
  onOpenChange: (dropdown: OpenDropdown) => void;
  onChange: (value: string) => void;
}) {
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? (value ? value : "همه");

  return (
    <div className="relative z-50 flex flex-col gap-2 text-sm">
      <span>{title}</span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => onOpenChange(isOpen ? null : id)}
        className="dashboard-muted-panel flex min-h-10 w-full items-center justify-between gap-3 px-4 py-2 text-right text-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-foreground">
            {selectedLabel}
          </span>
          {value ? (
            <span className="truncate text-xs text-muted-foreground">
              {value}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground" aria-hidden="true">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-[10080] mt-2 max-h-72 w-full min-w-64 overflow-y-auto rounded-2xl border border-border/60 bg-card/95 p-2 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              onChange("");
              onOpenChange(null);
            }}
            className="w-full rounded-xl px-3 py-2 text-right text-sm transition hover:bg-muted/70"
          >
            همه
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                onOpenChange(null);
              }}
              className="w-full rounded-xl px-3 py-2 text-right text-sm transition hover:bg-muted/70"
            >
              <span className="block font-medium text-foreground">
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {option.value}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AuditLogFilterPanel({
  action,
  targetType,
  status,
  actor,
  from,
  to,
}: AuditLogFilterPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [selectedAction, setSelectedAction] = useState(action ?? "");
  const [selectedTargetType, setSelectedTargetType] = useState(
    targetType ?? "",
  );
  const [selectedStatus, setSelectedStatus] = useState(status ?? "");
  const [actorValue, setActorValue] = useState(actor ?? "");
  const [fromDateKey, setFromDateKey] = useState(from ?? "");
  const [toDateKey, setToDateKey] = useState(to ?? "");

  const actionOptions = AUDIT_ACTION_VALUES.map((value) => ({
    value,
    label: getActionLabel(value),
  }));
  const targetTypeOptions = AUDIT_TARGET_TYPE_VALUES.map((value) => ({
    value,
    label: getTargetTypeLabel(value),
  }));
  const statusOptions = AUDIT_STATUS_VALUES.map((value) => ({
    value,
    label: getStatusLabel(value),
  }));

  const applyFilters = () => {
    startTransition(() => {
      router.push(
        buildAuditLogsHref({
          action: selectedAction,
          targetType: selectedTargetType,
          status: selectedStatus,
          actor: actorValue,
          from: fromDateKey,
          to: toDateKey,
        }),
      );
    });
  };

  return (
    <section className="dashboard-glass-card relative z-40 overflow-visible space-y-4">
      <h2 className="text-lg font-semibold">فیلتر لاگ‌ها</h2>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <FilterDropdown
          id="action"
          title="عملیات"
          value={selectedAction}
          options={actionOptions}
          isOpen={openDropdown === "action"}
          disabled={isPending}
          onOpenChange={setOpenDropdown}
          onChange={setSelectedAction}
        />

        <FilterDropdown
          id="targetType"
          title="نوع هدف"
          value={selectedTargetType}
          options={targetTypeOptions}
          isOpen={openDropdown === "targetType"}
          disabled={isPending}
          onOpenChange={setOpenDropdown}
          onChange={setSelectedTargetType}
        />

        <FilterDropdown
          id="status"
          title="وضعیت"
          value={selectedStatus}
          options={statusOptions}
          isOpen={openDropdown === "status"}
          disabled={isPending}
          onOpenChange={setOpenDropdown}
          onChange={setSelectedStatus}
        />

        <label className="flex flex-col gap-2 text-sm">
          کاربر
          <input
            type="text"
            value={actorValue}
            onChange={(event) => setActorValue(event.target.value)}
            disabled={isPending}
            className="dashboard-muted-panel min-h-10 w-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="نام یا نام کاربری"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          از تاریخ
          <div className="flex flex-col gap-2">
            <DatePicker
              calendar={persian}
              locale={persianFa}
              value={dateKeyToDateObject(fromDateKey)}
              calendarPosition="bottom-right"
              portal
              zIndex={10000}
              render={(value, openCalendar) => (
                <button
                  type="button"
                  onClick={openCalendar}
                  disabled={isPending}
                  className="dashboard-muted-panel min-h-10 w-full px-4 py-2 text-right text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {value || "انتخاب تاریخ"}
                </button>
              )}
              onChange={(value) => {
                if (!value || Array.isArray(value)) {
                  return;
                }

                const gregorianDate = dateObjectToGregorianDate(value);
                setFromDateKey(getDateKey(gregorianDate));
              }}
            />
            {fromDateKey ? (
              <button
                type="button"
                onClick={() => setFromDateKey("")}
                disabled={isPending}
                className="self-start text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                پاک کردن
              </button>
            ) : null}
          </div>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          تا تاریخ
          <div className="flex flex-col gap-2">
            <DatePicker
              calendar={persian}
              locale={persianFa}
              value={dateKeyToDateObject(toDateKey)}
              calendarPosition="bottom-right"
              portal
              zIndex={10000}
              render={(value, openCalendar) => (
                <button
                  type="button"
                  onClick={openCalendar}
                  disabled={isPending}
                  className="dashboard-muted-panel min-h-10 w-full px-4 py-2 text-right text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {value || "انتخاب تاریخ"}
                </button>
              )}
              onChange={(value) => {
                if (!value || Array.isArray(value)) {
                  return;
                }

                const gregorianDate = dateObjectToGregorianDate(value);
                setToDateKey(getDateKey(gregorianDate));
              }}
            />
            {toDateKey ? (
              <button
                type="button"
                onClick={() => setToDateKey("")}
                disabled={isPending}
                className="self-start text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                پاک کردن
              </button>
            ) : null}
          </div>
        </label>

        <div className="flex flex-wrap items-end gap-3 md:col-span-3 xl:col-span-6">
          <button
            type="button"
            onClick={applyFilters}
            disabled={isPending}
            className="dashboard-primary-button disabled:cursor-not-allowed disabled:opacity-60"
          >
            اعمال فیلتر
          </button>
          <Link href="/settings/audit-logs" className="dashboard-action-button">
            پاک‌کردن فیلترها
          </Link>
          {isPending ? (
            <p className="text-sm text-muted-foreground">
              در حال به‌روزرسانی فیلترها...
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
