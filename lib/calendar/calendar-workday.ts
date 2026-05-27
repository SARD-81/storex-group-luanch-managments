export function isBaseWeeklyOffDay(dayOfWeek: number): boolean {
  return dayOfWeek === 5 || dayOfWeek === 6;
}

export function resolveCalendarWorkday(input: {
  isWeeklyOffDay: boolean;
  isOfficialHoliday: boolean;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
}): boolean {
  if (input.isForcedWorkday) {
    return true;
  }

  if (input.isManualHoliday) {
    return false;
  }

  if (input.isOfficialHoliday) {
    return false;
  }

  if (input.isWeeklyOffDay) {
    return false;
  }

  return true;
}
