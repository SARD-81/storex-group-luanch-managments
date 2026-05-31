import { UserRole } from "@/app/generated/prisma/client";

export const ROLE_LABELS = {
  [UserRole.USER]: "کاربر",
  [UserRole.ADMIN]: "مدیر",
  [UserRole.REPORTER]: "گزارش‌گیر",
} as const;

export const USER_ROLE_OPTIONS = [
  { value: UserRole.USER, label: ROLE_LABELS[UserRole.USER] },
  { value: UserRole.ADMIN, label: ROLE_LABELS[UserRole.ADMIN] },
  { value: UserRole.REPORTER, label: ROLE_LABELS[UserRole.REPORTER] },
] as const;

export function canAccessReporterPage(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.REPORTER;
}

export function isReporterRole(role: UserRole) {
  return role === UserRole.REPORTER;
}

export const MEAL_PARTICIPANT_ROLE_FILTER = { not: UserRole.REPORTER } as const;
