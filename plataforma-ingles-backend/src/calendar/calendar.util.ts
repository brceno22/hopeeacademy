/** IANA TZ del plan (Ecuador). */
export const CALENDAR_TZ = 'America/Guayaquil';

export type OccurrenceStatus = 'upcoming' | 'live' | 'done';

export interface CalendarOccurrence {
  id: string;
  source: 'shift' | 'event';
  sourceId: number;
  title: string;
  description: string | null;
  startsAt: string; // ISO
  endsAt: string;
  meetUrl: string | null;
  shiftId: number;
  shiftName: string;
  folderName: string | null;
  googleUrl?: string;
  status?: OccurrenceStatus;
}

export function occurrenceStatus(
  startsAt: string,
  endsAt: string,
  now: Date = new Date(),
): OccurrenceStatus {
  const t = now.getTime();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (t < start) return 'upcoming';
  if (t > end) return 'done';
  return 'live';
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

/** Día de la semana 0=dom…6=sáb para una fecha civil YYYY-MM-DD (sin TZ drift). */
export function weekdayOfYmd(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  // Date.UTC noon evita edge cases DST
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

/**
 * Convierte fecha civil + HH:mm en America/Guayaquil a Instant ISO.
 * Guayaquil es UTC-5 todo el año (sin DST).
 */
export function guayaquilLocalToIso(ymd: string, hm: string): string {
  const { y, m, d } = parseYmd(ymd);
  const [hh, mm] = hm.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh + 5, mm, 0); // local = UTC-5 → UTC = local+5
  return new Date(utcMs).toISOString();
}

export function expandShiftOccurrences(params: {
  shiftId: number;
  shiftName: string;
  folderName: string | null;
  title: string;
  description: string | null;
  meetUrl: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  validFrom: string | null;
  validTo: string | null;
  from: string;
  to: string;
}): CalendarOccurrence[] {
  const days = new Set(params.daysOfWeek.map(Number));
  const rangeStart =
    params.validFrom && params.validFrom > params.from ? params.validFrom : params.from;
  const rangeEnd = params.validTo && params.validTo < params.to ? params.validTo : params.to;
  if (rangeStart > rangeEnd) return [];

  const out: CalendarOccurrence[] = [];
  for (const ymd of eachDateInclusive(rangeStart, rangeEnd)) {
    if (!days.has(weekdayOfYmd(ymd))) continue;
    const startsAt = guayaquilLocalToIso(ymd, params.startTime);
    const endsAt = guayaquilLocalToIso(ymd, params.endTime);
    out.push({
      id: `shift-${params.shiftId}-${ymd}`,
      source: 'shift',
      sourceId: params.shiftId,
      title: params.title,
      description: params.description,
      startsAt,
      endsAt,
      meetUrl: params.meetUrl,
      shiftId: params.shiftId,
      shiftName: params.shiftName,
      folderName: params.folderName,
    });
  }
  return out;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

export function buildIcsCalendar(occurrences: CalendarOccurrence[], calName = 'Hopee'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hopee Academy//Calendar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];

  for (const o of occurrences) {
    const descParts = [o.description, o.meetUrl ? `Meet: ${o.meetUrl}` : null, o.shiftName]
      .filter(Boolean)
      .join('\\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(o.id)}@hopee.academy`,
      `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
      `DTSTART:${toIcsUtc(o.startsAt)}`,
      `DTEND:${toIcsUtc(o.endsAt)}`,
      `SUMMARY:${icsEscape(o.title)}`,
      `DESCRIPTION:${icsEscape(descParts)}`,
      o.meetUrl ? `URL:${icsEscape(o.meetUrl)}` : '',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.filter((l) => l !== '').join('\r\n') + '\r\n';
}

/** Link template de Google Calendar para un solo evento. */
export function googleCalendarTemplateUrl(o: CalendarOccurrence): string {
  const fmt = (iso: string) => toIcsUtc(iso);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: o.title,
    dates: `${fmt(o.startsAt)}/${fmt(o.endsAt)}`,
    details: [o.description, o.meetUrl].filter(Boolean).join('\n'),
  });
  if (o.meetUrl) params.set('location', o.meetUrl);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
