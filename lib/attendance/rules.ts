export function getMaxSelectableDate(now = new Date()) {
  const result = new Date(now);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export function getAttendanceDeadline(targetDate: Date) {
  const deadline = new Date(targetDate);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(8, 0, 0, 0);
  return deadline;
}

export function canEditAttendance(targetDate: Date, now = new Date()) {
  return now < getAttendanceDeadline(targetDate);
}