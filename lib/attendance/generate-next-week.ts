/** Retired: legacy weekly preferences must never produce new attendance. */
export async function generateNextWeekAttendance(): Promise<never> {
  throw new Error("Recurring weekly attendance generation is retired; use daily management.");
}
