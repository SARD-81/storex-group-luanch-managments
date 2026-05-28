import {
  OFFICIAL_1405_EVENTS,
  OFFICIAL_1405_EVENT_MONTHS,
  OFFICIAL_1405_EVENT_MONTH_COUNTS,
  OFFICIAL_1405_EXPECTED_TOTAL_EVENTS,
} from "../data/calendar/iran/official-1405";

const ALLOWED_SOURCE_SECTIONS = new Set([
  "MAIN_MONTH_TABLE",
  "APPENDIX_TABLE",
  "ASTRONOMICAL_NOTES",
  "MANUAL",
]);

const ALLOWED_CALENDAR_TYPES = new Set(["GREGORIAN", "JALALI", "HIJRI"]);

const ALLOWED_EVENT_TYPES = new Set([
  "NATIONAL",
  "RELIGIOUS",
  "INTERNATIONAL",
  "CULTURAL",
  "ORGANIZATIONAL",
  "OFFICIAL",
  "OTHER",
]);

const errors: string[] = [];
const eventKeys = new Set<string>();
const displayOrderByDate = new Map<string, Set<number>>();
let holidayEventCount = 0;

if (OFFICIAL_1405_EVENTS.length !== OFFICIAL_1405_EXPECTED_TOTAL_EVENTS) {
  errors.push(
    `Expected ${OFFICIAL_1405_EXPECTED_TOTAL_EVENTS} total events, received ${OFFICIAL_1405_EVENTS.length}.`,
  );
}

for (const [monthName, monthEvents] of Object.entries(OFFICIAL_1405_EVENT_MONTHS)) {
  const expectedCount = OFFICIAL_1405_EVENT_MONTH_COUNTS[monthName as keyof typeof OFFICIAL_1405_EVENT_MONTH_COUNTS];
  if (monthEvents.length !== expectedCount) {
    errors.push(`Month '${monthName}' expected ${expectedCount} events, received ${monthEvents.length}.`);
  }
}

for (const [index, event] of OFFICIAL_1405_EVENTS.entries()) {
  const context = `Event index ${index}`;

  if (!event.eventKey?.trim()) {
    errors.push(`${context}: eventKey must be non-empty.`);
  } else {
    if (eventKeys.has(event.eventKey)) {
      errors.push(`${context}: duplicate eventKey '${event.eventKey}'.`);
    }
    eventKeys.add(event.eventKey);
  }

  const dateMatch = event.jalaliDateKey.match(/^1405-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/);
  if (!dateMatch) {
    errors.push(`${context}: jalaliDateKey '${event.jalaliDateKey}' is invalid.`);
  } else {
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);

    const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 29;
    if (day < 1 || day > maxDay) {
      errors.push(`${context}: jalaliDateKey '${event.jalaliDateKey}' has invalid day for month ${month}.`);
    }
  }

  if (!event.title?.trim()) {
    errors.push(`${context}: title must be non-empty.`);
  }

  if (!Number.isInteger(event.sourcePage) || event.sourcePage < 3 || event.sourcePage > 17) {
    errors.push(`${context}: sourcePage '${event.sourcePage}' must be an integer between 3 and 17.`);
  }

  if (!Number.isInteger(event.displayOrder) || event.displayOrder <= 0) {
    errors.push(`${context}: displayOrder '${event.displayOrder}' must be a positive integer.`);
  }

  if (!ALLOWED_SOURCE_SECTIONS.has(event.sourceSection)) {
    errors.push(`${context}: sourceSection '${event.sourceSection}' is invalid.`);
  }

  if (!ALLOWED_CALENDAR_TYPES.has(event.calendarType)) {
    errors.push(`${context}: calendarType '${event.calendarType}' is invalid.`);
  }

  if (!ALLOWED_EVENT_TYPES.has(event.type)) {
    errors.push(`${context}: type '${event.type}' is invalid.`);
  }

  if (event.isHoliday) {
    holidayEventCount += 1;
  }

  const dateKey = event.jalaliDateKey;
  if (!displayOrderByDate.has(dateKey)) {
    displayOrderByDate.set(dateKey, new Set<number>());
  }

  const usedDisplayOrders = displayOrderByDate.get(dateKey);
  if (usedDisplayOrders?.has(event.displayOrder)) {
    errors.push(
      `${context}: duplicate displayOrder '${event.displayOrder}' for jalaliDateKey '${dateKey}'.`,
    );
  }
  usedDisplayOrders?.add(event.displayOrder);
}

if (holidayEventCount === 0) {
  errors.push("At least one holiday event must exist.");
}

const eventCountsByMonth = new Map<number, number>();
const holidayCountsByMonth = new Map<number, number>();

for (const event of OFFICIAL_1405_EVENTS) {
  const month = Number(event.jalaliDateKey.slice(5, 7));
  eventCountsByMonth.set(month, (eventCountsByMonth.get(month) ?? 0) + 1);
  if (event.isHoliday) {
    holidayCountsByMonth.set(month, (holidayCountsByMonth.get(month) ?? 0) + 1);
  }
}

const sortedMonths = Array.from(eventCountsByMonth.keys()).sort((a, b) => a - b);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("Official 1405 calendar event validation failed.");
  process.exit(1);
}

console.log("Official 1405 calendar event validation passed.");
console.log("Total events: 426");
console.log("Event counts by month:");
for (const month of sortedMonths) {
  console.log(`  ${String(month).padStart(2, "0")}: ${eventCountsByMonth.get(month) ?? 0}`);
}

console.log("Holiday counts by month:");
for (const month of sortedMonths) {
  console.log(`  ${String(month).padStart(2, "0")}: ${holidayCountsByMonth.get(month) ?? 0}`);
}
