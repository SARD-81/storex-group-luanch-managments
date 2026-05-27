export type FixedJalaliOfficialHoliday = {
  month: number;
  day: number;
  title: string;
};

export const FIXED_JALALI_OFFICIAL_HOLIDAYS: FixedJalaliOfficialHoliday[] = [
  { month: 1, day: 1, title: "جشن نوروز" },
  { month: 1, day: 2, title: "عید نوروز" },
  { month: 1, day: 3, title: "عید نوروز" },
  { month: 1, day: 4, title: "عید نوروز" },
  { month: 1, day: 12, title: "روز جمهوری اسلامی" },
  { month: 1, day: 13, title: "روز طبیعت" },
  { month: 3, day: 14, title: "رحلت امام خمینی" },
  { month: 3, day: 15, title: "قیام ۱۵ خرداد" },
  { month: 11, day: 22, title: "پیروزی انقلاب اسلامی" },
  { month: 12, day: 29, title: "ملی شدن صنعت نفت ایران" },
];
