import { FARVARDIN_1405_EVENTS } from "./farvardin";
import { ORDIBEHESHT_1405_EVENTS } from "./ordibehesht";
import { KHORDAD_1405_EVENTS } from "./khordad";
import { TIR_1405_EVENTS } from "./tir";
import { MORDAD_1405_EVENTS } from "./mordad";
import { SHAHRIVAR_1405_EVENTS } from "./shahrivar";
import { MEHR_1405_EVENTS } from "./mehr";
import { ABAN_1405_EVENTS } from "./aban";
import { AZAR_1405_EVENTS } from "./azar";
import { DEY_1405_EVENTS } from "./dey";
import { BAHMAN_1405_EVENTS } from "./bahman";
import { ESFAND_1405_EVENTS } from "./esfand";

import type { OfficialCalendarEvent1405 } from "./types";

export type {
  OfficialCalendarDateSystem,
  OfficialCalendarEvent1405,
  OfficialCalendarEventSourceSection,
  OfficialCalendarEventType,
} from "./types";

export const OFFICIAL_1405_EVENT_MONTHS = {
  farvardin: FARVARDIN_1405_EVENTS,
  ordibehesht: ORDIBEHESHT_1405_EVENTS,
  khordad: KHORDAD_1405_EVENTS,
  tir: TIR_1405_EVENTS,
  mordad: MORDAD_1405_EVENTS,
  shahrivar: SHAHRIVAR_1405_EVENTS,
  mehr: MEHR_1405_EVENTS,
  aban: ABAN_1405_EVENTS,
  azar: AZAR_1405_EVENTS,
  dey: DEY_1405_EVENTS,
  bahman: BAHMAN_1405_EVENTS,
  esfand: ESFAND_1405_EVENTS,
} as const satisfies Record<string, readonly OfficialCalendarEvent1405[]>;

export const OFFICIAL_1405_EVENT_MONTH_COUNTS = {
  farvardin: 32,
  ordibehesht: 40,
  khordad: 39,
  tir: 40,
  mordad: 34,
  shahrivar: 46,
  mehr: 37,
  aban: 28,
  azar: 36,
  dey: 40,
  bahman: 19,
  esfand: 33,
} as const;

export const OFFICIAL_1405_EXPECTED_TOTAL_EVENTS = 424;

export const OFFICIAL_1405_EVENTS: OfficialCalendarEvent1405[] = [
  ...FARVARDIN_1405_EVENTS,
  ...ORDIBEHESHT_1405_EVENTS,
  ...KHORDAD_1405_EVENTS,
  ...TIR_1405_EVENTS,
  ...MORDAD_1405_EVENTS,
  ...SHAHRIVAR_1405_EVENTS,
  ...MEHR_1405_EVENTS,
  ...ABAN_1405_EVENTS,
  ...AZAR_1405_EVENTS,
  ...DEY_1405_EVENTS,
  ...BAHMAN_1405_EVENTS,
  ...ESFAND_1405_EVENTS,
];
