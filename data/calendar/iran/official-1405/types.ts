export type OfficialCalendarEventType =
  | "NATIONAL"
  | "RELIGIOUS"
  | "INTERNATIONAL"
  | "CULTURAL"
  | "ORGANIZATIONAL"
  | "OFFICIAL"
  | "OTHER";

export type OfficialCalendarDateSystem = "GREGORIAN" | "JALALI" | "HIJRI";

export type OfficialCalendarEventSourceSection =
  | "MAIN_MONTH_TABLE"
  | "APPENDIX_TABLE"
  | "ASTRONOMICAL_NOTES"
  | "MANUAL";

export type OfficialCalendarEvent1405 = {
  eventKey: string;
  jalaliDateKey: string;
  title: string;
  type: OfficialCalendarEventType;
  calendarType: OfficialCalendarDateSystem;
  isHoliday: boolean;
  displayOrder: number;
  sourcePage: number;
  sourceSection: OfficialCalendarEventSourceSection;
  referenceDate?: string;
};
