import { CompanyLogo } from "@/components/branding/company-logo";
import Link from "next/link";
import { AttendanceSource, MealType, UserRole } from "@/app/generated/prisma/client";
import { setAdminAttendanceAction } from "@/actions/attendance";
import { AdminDateFilter } from "@/components/attendance/admin-date-filter";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { getCalendarDayByDateKey } from "@/lib/calendar/calendar-service";
import { parseDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";
import { prisma } from "@/lib/prisma";
const origins: Record<AttendanceSource, string> = { ADMIN_OVERRIDE: "توسط مدیر", USER_MANUAL: "انتخاب کاربر", AUTO_RESERVATION: "رزرو خودکار", LEGACY_WEEKLY_PLAN: "سابقه برنامه قدیمی" };
export const dynamic = "force-dynamic";
export default async function DailyAttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; q?: string; saved?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const dateKey = params.date ?? getTehranDateKey(), date = parseDateKey(dateKey);
  if (!date) return <main dir="rtl"><p role="alert">تاریخ معتبر نیست.</p><Link href="/settings/attendance">انتخاب تاریخ</Link></main>;
  const [day, users, rows] = await Promise.all([
    getCalendarDayByDateKey(prisma,dateKey),
    prisma.user.findMany({ where: { isActive:true, role:{not:UserRole.REPORTER}, ...(params.q ? { OR:[{name:{contains:params.q,mode:"insensitive" as const}},{username:{contains:params.q,mode:"insensitive" as const}}] } : {}) },select:{id:true,name:true,username:true},orderBy:{name:"asc"} }),
    prisma.mealAttendance.findMany({where:{date}}),
  ]);
  const map = new Map(rows.map(r=>[`${r.userId}:${r.mealType}`,r]));
  return <main dir="rtl" className="dashboard-aurora-shell min-h-screen p-6 text-foreground"><div className="mx-auto max-w-7xl space-y-6">
    <header className="dashboard-glass-card space-y-3">
          <CompanyLogo /><h1 className="text-2xl font-bold">مدیریت حضور و رزرو روزانه</h1><Link href="/">داشبورد</Link><AdminDateFilter key={dateKey} dateKey={dateKey}/>
      <p>{day?.dayNameFa} {day?.jalaliDateKey} — {dateKey} — {day ? day.isWorkday ? "روز کاری" : "غیرکاری" : "تقویم این تاریخ موجود نیست"}</p>
      <p>{[day?.isOfficialHoliday && "تعطیل رسمی",day?.isWeeklyOffDay && "تعطیلی هفتگی",day?.isManualHoliday && "تعطیلی دستی",day?.isForcedWorkday && "روز کاری اجباری"].filter(Boolean).join("، ")}</p>
      <p>{day?.holidayTitle}</p>{day?.events.map((e,i)=><p key={i} className="text-sm">{e.title}</p>)}
      {!day?.isWorkday ? <p>برای رزرو وعده‌ها ابتدا این تاریخ را در <Link href={`/settings/calendar-overrides?date=${dateKey}`}>مدیریت تقویم</Link> روز کاری اجباری کنید.</p> : null}
      {params.saved ? <p role="status">تغییر ذخیره شد.</p> : null}
    </header>
    <form method="get" className="flex gap-3"><input type="hidden" name="date" value={dateKey}/><input aria-label="جستجوی افراد" name="q" defaultValue={params.q} className="dashboard-muted-panel" placeholder="نام یا نام کاربری"/><button className="dashboard-action-button">جستجو</button></form>
    <section className="dashboard-glass-card overflow-x-auto"><table className="w-full text-right"><thead><tr><th>کاربر</th><th>صبحانه</th><th>ناهار</th></tr></thead><tbody>
      {users.map(u=><tr key={u.id} className="border-b"><td className="p-3">{u.name}<small className="block">@{u.username}</small></td>{[MealType.BREAKFAST,MealType.LUNCH].map(meal=>{const row=map.get(`${u.id}:${meal}`);return <td className="p-3" key={meal}>
        <p>{row?.status === "PRESENT" ? "حاضر" : "غایب"} — {row ? origins[row.source] : "بدون رزرو"}</p><small>{day?.isWorkday ? "قابل تغییر توسط مدیر" : "رزرو غیرفعال برای روز غیرکاری"}</small>
        <form action={setAdminAttendanceAction} className="flex flex-wrap gap-2 mt-2"><input type="hidden" name="date" value={dateKey}/><input type="hidden" name="userId" value={u.id}/><input type="hidden" name="mealType" value={meal}/>
          <PendingSubmitButton name="status" value="PRESENT" disabled={!day?.isWorkday} pendingText="ذخیره…" className="dashboard-action-button">حاضر</PendingSubmitButton>
          <PendingSubmitButton name="status" value="ABSENT" disabled={!day?.isWorkday} pendingText="ذخیره…" className="dashboard-action-button">غایب</PendingSubmitButton>
          <PendingSubmitButton name="status" value="CLEAR" disabled={row?.source!=="ADMIN_OVERRIDE"} pendingText="حذف…" className="dashboard-action-button">لغو تصمیم مدیر</PendingSubmitButton>
        </form></td>;})}</tr>)}
    </tbody></table></section></div></main>;
}
