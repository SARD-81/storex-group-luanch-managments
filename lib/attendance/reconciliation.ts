import {
  AttendanceSource,
  AttendanceStatus,
  AuditAction,
  AuditStatus,
  AuditTargetType,
  MealType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@/app/generated/prisma/client";
import { getAttendanceReservationWindow } from "./month";
import { canEditAttendance } from "./rules";
import { getDateKey, parseDateKey } from "../date/date-key";
import { getTehranDateKey } from "../date/tehran-time";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; username: string; name: string; role: UserRole };
type Decision = { source: AttendanceSource; status: AttendanceStatus };
type AutoUser = {
  isActive: boolean;
  role: UserRole;
  autoBreakfast: boolean;
  autoLunch: boolean;
  autoBreakfastFrom: Date | null;
  autoLunchFrom: Date | null;
};
export const ATTENDANCE_LOCK = 641705;

// All attendance writers and policy changes share this transaction lock.
export async function attendanceTransaction<T>(
  db: PrismaClient,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ATTENDANCE_LOCK})`;
      return work(tx);
    },
    { timeout: 60000, maxWait: 15000 },
  );
}

export async function attendanceAudit(
  tx: Tx,
  action: AuditAction,
  actor: Actor | null,
  metadata: Prisma.InputJsonValue,
  status: AuditStatus = AuditStatus.SUCCESS,
) {
  await tx.auditLog.create({
    data: {
      action,
      targetType: action.startsWith("AUTOMATION")
        ? AuditTargetType.SYSTEM
        : action.startsWith("CALENDAR")
          ? AuditTargetType.CALENDAR_DAY
          : AuditTargetType.MEAL_ATTENDANCE,
      status,
      actorUserId: actor?.id,
      actorUsername: actor?.username,
      actorName: actor?.name,
      actorRole: actor?.role,
      metadata,
    },
  });
}

export function resolveAttendance(
  decisions: Decision[],
  auto: boolean,
): Decision | null {
  for (const source of [
    AttendanceSource.ADMIN_OVERRIDE,
    AttendanceSource.USER_MANUAL,
  ]) {
    const decision = decisions.find((d) => d.source === source);
    if (decision) return decision;
  }
  if (auto)
    return {
      source: AttendanceSource.AUTO_RESERVATION,
      status: AttendanceStatus.PRESENT,
    };
  return (
    decisions.find((d) => d.source === AttendanceSource.LEGACY_WEEKLY_PLAN) ??
    null
  );
}

export function automaticMealApplies(
  user: AutoUser,
  meal: MealType,
  date: Date,
  workday: boolean,
  now = new Date(),
) {
  const enabled =
    meal === MealType.BREAKFAST ? user.autoBreakfast : user.autoLunch;
  const from =
    meal === MealType.BREAKFAST ? user.autoBreakfastFrom : user.autoLunchFrom;
  return (
    user.isActive &&
    user.role !== UserRole.REPORTER &&
    workday &&
    enabled &&
    !!from &&
    getDateKey(date) >= getDateKey(from) &&
    getDateKey(date) >= getTehranDateKey(now)
  );
}

export async function reconcileAttendanceTx(
  tx: Tx,
  options: { from: string; to: string; userId?: string; now?: Date },
) {
  const now = options.now ?? new Date();
  const from = parseDateKey(options.from),
    to = parseDateKey(options.to);
  if (!from || !to || from > to) throw new Error("INVALID_ATTENDANCE_RANGE");
  const where = {
    date: { gte: from, lte: to },
    ...(options.userId ? { userId: options.userId } : {}),
  };
  const [users, days, decisions, existing] = await Promise.all([
    tx.user.findMany({
      where: options.userId ? { id: options.userId } : {},
      select: {
        id: true,
        isActive: true,
        role: true,
        autoBreakfast: true,
        autoLunch: true,
        autoBreakfastFrom: true,
        autoLunchFrom: true,
      },
    }),
    tx.calendarDay.findMany({
      where: { date: where.date },
      select: { date: true, isWorkday: true },
    }),
    tx.attendanceDecision.findMany({ where }),
    tx.mealAttendance.findMany({ where }),
  ]);
  const key = (u: string, d: Date, m: MealType) => `${u}:${getDateKey(d)}:${m}`;
  const decisionMap = new Map<string, Decision[]>();
  for (const d of decisions) {
    const k = key(d.userId, d.date, d.mealType);
    decisionMap.set(k, [...(decisionMap.get(k) ?? []), d]);
  }
  const rowMap = new Map(
    existing.map((r) => [key(r.userId, r.date, r.mealType), r]),
  );
  const workdays = new Map(days.map((d) => [getDateKey(d.date), d.isWorkday]));
  const dates = new Map(
    [...days, ...existing].map((d) => [getDateKey(d.date), d.date]),
  );
  const create: Prisma.MealAttendanceCreateManyInput[] = [];
  const remove: string[] = [];
  let updated = 0;
  for (const user of users)
    for (const date of dates.values())
      for (const mealType of [MealType.BREAKFAST, MealType.LUNCH]) {
        const k = key(user.id, date, mealType),
          old = rowMap.get(k);
        const effective = resolveAttendance(
          decisionMap.get(k) ?? [],
          automaticMealApplies(
            user,
            mealType,
            date,
            workdays.get(getDateKey(date)) === true,
            now,
          ),
        );
        if (!effective) {
          // No decision is ever deleted by reconciliation. Only its projection changes.
          if (
            old &&
            (old.source === AttendanceSource.AUTO_RESERVATION ||
              old.source === AttendanceSource.ADMIN_OVERRIDE)
          )
            remove.push(old.id);
          continue;
        }
        const flags = {
          generatedFromWeeklyPlan:
            effective.source === AttendanceSource.LEGACY_WEEKLY_PLAN,
          manuallyEdited:
            effective.source === AttendanceSource.USER_MANUAL ||
            effective.source === AttendanceSource.ADMIN_OVERRIDE,
        };
        if (!old)
          create.push({
            userId: user.id,
            date,
            mealType,
            ...effective,
            ...flags,
          });
        else if (
          old.status !== effective.status ||
          old.source !== effective.source
        ) {
          await tx.mealAttendance.update({
            where: { id: old.id },
            data: { ...effective, ...flags },
          });
          updated++;
        }
      }
  const created = create.length
    ? (await tx.mealAttendance.createMany({ data: create })).count
    : 0;
  const deleted = remove.length
    ? (await tx.mealAttendance.deleteMany({ where: { id: { in: remove } } }))
        .count
    : 0;
  const summary = {
    from: options.from,
    to: options.to,
    created,
    updated,
    deleted,
  };
  if (created + updated + deleted)
    await attendanceAudit(tx, AuditAction.ATTENDANCE_RECONCILED, null, summary);
  return summary;
}

/** Calendar imports reconcile current coverage and all already projected future AUTO rows. */
export async function reconcileCalendarAttendanceTx(tx: Tx, now = new Date()) {
  const window = getAttendanceReservationWindow(now);
  const lastAuto = await tx.mealAttendance.findFirst({
    where: {
      source: AttendanceSource.AUTO_RESERVATION,
      date: { gte: parseDateKey(window.todayDateKey)! },
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const to =
    lastAuto && getDateKey(lastAuto.date) > window.maxDateKey
      ? getDateKey(lastAuto.date)
      : window.maxDateKey;
  return reconcileAttendanceTx(tx, { from: window.todayDateKey, to, now });
}

export async function reconcileAttendance(
  db: PrismaClient,
  options: { from?: string; to?: string; userId?: string; now?: Date } = {},
) {
  const window = getAttendanceReservationWindow(options.now);
  // Extend to existing automatic coverage so disabling/deactivation cannot leave future rows.
  const lastAuto = await db.mealAttendance.findFirst({
    where: {
      source: AttendanceSource.AUTO_RESERVATION,
      ...(options.userId ? { userId: options.userId } : {}),
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const end =
    lastAuto && getDateKey(lastAuto.date) > window.maxDateKey
      ? getDateKey(lastAuto.date)
      : window.maxDateKey;
  return attendanceTransaction(db, (tx) =>
    reconcileAttendanceTx(tx, {
      from: options.from ?? window.todayDateKey,
      to: options.to ?? end,
      userId: options.userId,
      now: options.now,
    }),
  );
}

export async function setAdminAttendance(
  db: PrismaClient,
  actor: Actor,
  input: {
    userId: string;
    dateKey: string;
    mealType: MealType;
    status: AttendanceStatus | null;
  },
  now = new Date(),
) {
  if (actor.role !== UserRole.ADMIN) throw new Error("ADMIN_REQUIRED");
  return attendanceTransaction(db, async (tx) => {
    const date = parseDateKey(input.dateKey);
    if (!date) throw new Error("INVALID_DATE");
    const [day, user] = await Promise.all([
      tx.calendarDay.findUnique({ where: { dateKey: input.dateKey } }),
      tx.user.findUnique({ where: { id: input.userId } }),
    ]);
    if (
      !day ||
      (input.status !== null && !day.isWorkday) ||
      !user?.isActive ||
      user.role === UserRole.REPORTER
    )
      throw new Error("NON_WORKDAY_OR_INELIGIBLE_USER");
    const where = {
      userId: user.id,
      date,
      mealType: input.mealType,
      source: AttendanceSource.ADMIN_OVERRIDE,
    };
    const previous = await tx.attendanceDecision.findUnique({
      where: { userId_date_mealType_source: where },
    });
    if (input.status === null)
      await tx.attendanceDecision.deleteMany({ where });
    else
      await tx.attendanceDecision.upsert({
        where: { userId_date_mealType_source: where },
        create: { ...where, status: input.status },
        update: { status: input.status },
      });
    await reconcileAttendanceTx(tx, {
      from: input.dateKey,
      to: input.dateKey,
      userId: user.id,
      now,
    });
    await attendanceAudit(
      tx,
      input.status === null
        ? AuditAction.ATTENDANCE_OVERRIDE_CLEARED
        : AuditAction.ATTENDANCE_OVERRIDE_APPLIED,
      actor,
      { ...input, before: previous?.status ?? null },
    );
  });
}

export async function setUserAttendance(
  db: PrismaClient,
  actor: Actor,
  changes: { dateKey: string; mealType: MealType; status: AttendanceStatus }[],
  now = new Date(),
) {
  return attendanceTransaction(db, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    if (!user?.isActive || user.role === UserRole.REPORTER)
      throw new Error("INELIGIBLE_USER");
    const dates = [...new Set(changes.map((c) => c.dateKey))];
    const window = getAttendanceReservationWindow(now);
    const days = await tx.calendarDay.findMany({
      where: { dateKey: { in: dates } },
    });
    if (
      dates.some(
        (k) =>
          !parseDateKey(k) ||
          k < window.todayDateKey ||
          k > window.maxDateKey ||
          !days.find((d) => d.dateKey === k)?.isWorkday ||
          !canEditAttendance(parseDateKey(k)!, now),
      )
    )
      throw new Error("INVALID_DATE_OR_DEADLINE");
    const rows = await tx.mealAttendance.findMany({
      where: {
        userId: actor.id,
        date: { in: dates.map((k) => parseDateKey(k)!) },
      },
    });
    let changed = 0,
      blocked = 0;
    for (const change of changes) {
      const old = rows.find(
        (r) =>
          getDateKey(r.date) === change.dateKey &&
          r.mealType === change.mealType,
      );
      if (old?.source === AttendanceSource.ADMIN_OVERRIDE) {
        if (old.status !== change.status) blocked++;
        continue;
      }
      if (old?.status === change.status) continue;
      const where = {
        userId: actor.id,
        date: parseDateKey(change.dateKey)!,
        mealType: change.mealType,
        source: AttendanceSource.USER_MANUAL,
      };
      await tx.attendanceDecision.upsert({
        where: { userId_date_mealType_source: where },
        create: { ...where, status: change.status },
        update: { status: change.status },
      });
      changed++;
    }
    for (const dateKey of dates)
      await reconcileAttendanceTx(tx, {
        from: dateKey,
        to: dateKey,
        userId: actor.id,
        now,
      });
    if (changed)
      await attendanceAudit(tx, AuditAction.ATTENDANCE_UPDATED, actor, {
        changed,
        dateKeys: dates,
      });
    if (blocked)
      await attendanceAudit(
        tx,
        AuditAction.ATTENDANCE_OVERRIDE_BLOCKED,
        actor,
        { blocked, dateKeys: dates },
        AuditStatus.DENIED,
      );
    return { changed, blocked };
  });
}

export async function configureAutomaticMeals(
  db: PrismaClient,
  actor: Actor,
  userId: string,
  breakfast: boolean,
  lunch: boolean,
  now = new Date(),
) {
  if (actor.role !== UserRole.ADMIN) throw new Error("ADMIN_REQUIRED");
  return attendanceTransaction(db, async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === UserRole.REPORTER) throw new Error("REPORTER_EXCLUDED");
    const today = parseDateKey(getTehranDateKey(now))!;
    await tx.user.update({
      where: { id: userId },
      data: {
        autoBreakfast: breakfast,
        autoLunch: lunch,
        autoBreakfastFrom: breakfast
          ? user.autoBreakfast
            ? (user.autoBreakfastFrom ?? today)
            : today
          : user.autoBreakfastFrom,
        autoLunchFrom: lunch
          ? user.autoLunch
            ? (user.autoLunchFrom ?? today)
            : today
          : user.autoLunchFrom,
      },
    });
    const window = getAttendanceReservationWindow(now);
    const last = await tx.mealAttendance.findFirst({
      where: { userId, source: AttendanceSource.AUTO_RESERVATION },
      orderBy: { date: "desc" },
    });
    await reconcileAttendanceTx(tx, {
      userId,
      from: window.todayDateKey,
      to:
        last && getDateKey(last.date) > window.maxDateKey
          ? getDateKey(last.date)
          : window.maxDateKey,
      now,
    });
    await attendanceAudit(tx, AuditAction.AUTO_RESERVATION_CHANGED, actor, {
      userId,
      before: { breakfast: user.autoBreakfast, lunch: user.autoLunch },
      after: { breakfast, lunch },
      startsFrom: getDateKey(today),
    });
  });
}
