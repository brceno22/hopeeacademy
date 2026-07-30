/** Helpers de fecha con timezone fija (default America/Guayaquil). */

export function getAppTimeZone(): string {
  return process.env.APP_TZ || 'America/Guayaquil';
}

/** YYYY-MM-DD en la timezone de la app. */
export function dateStringInAppTz(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Resta días calendario y formatea en APP_TZ. */
export function addDaysInAppTz(base: Date, deltaDays: number): string {
  const shifted = new Date(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return dateStringInAppTz(shifted);
}
