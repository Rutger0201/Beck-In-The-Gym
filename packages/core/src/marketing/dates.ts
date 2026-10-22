// Calendar dates are plain YYYY-MM-DD strings in the business time zone; no time-of-day drift.
export const businessTimeZone = "Europe/Amsterdam";
export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export function localDate(now = new Date(), timeZone = businessTimeZone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function utc(date: string): Date {
  if (!isoDatePattern.test(date)) throw new Error("Invalid date");
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw new Error("Invalid date");
  return value;
}
export function isValidDate(date: string): boolean { try { utc(date); return true; } catch { return false; } }
export function addDays(date: string, days: number): string { const value = utc(date); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
export function daysBetween(from: string, to: string): number { return Math.round((utc(to).getTime() - utc(from).getTime()) / 86400000); }
// 1 = Monday ... 7 = Sunday
export function isoWeekday(date: string): number { return utc(date).getUTCDay() || 7; }
export function startOfWeek(date: string): string { return addDays(date, 1 - isoWeekday(date)); }
export function startOfMonth(date: string): string { return `${date.slice(0, 7)}-01`; }
export function addMonths(date: string, months: number): string { const value = utc(startOfMonth(date)); value.setUTCMonth(value.getUTCMonth() + months); return value.toISOString().slice(0, 10); }
export function monthOf(date: string): number { return Number(date.slice(5, 7)); }
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("nl-NL", { ...options, timeZone: "UTC" }).format(utc(date));
}
