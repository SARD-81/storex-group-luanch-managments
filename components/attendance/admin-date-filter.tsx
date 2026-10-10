"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { getDateKey } from "@/lib/date/date-key";
export function AdminDateFilter({ dateKey }: { dateKey: string }) {
  const [draft, setDraft] = useState(dateKey), [pending, transition] = useTransition();
  const router = useRouter();
  const value = useMemo(() => { const [y,m,d] = draft.split("-").map(Number);return new DateObject({ date: new Date(y,m-1,d), calendar: persian, locale: persianFa }); }, [draft]);
  return <div className="flex flex-wrap gap-3 items-center"><DatePicker value={value} calendar={persian} locale={persianFa} portal
    onChange={v => { if (v && !Array.isArray(v)) { const d=v.toDate();setDraft(getDateKey(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())))); } }} />
    <button className="dashboard-primary-button" disabled={pending} onClick={() => { if (draft!==dateKey) transition(()=>router.push(`/settings/attendance?date=${draft}`)); }}>نمایش تاریخ</button></div>;
}
