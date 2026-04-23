import type { ContactSummary } from "./highlevel";

export type UpcomingBirthday = {
  contact: ContactSummary;
  /** Month-day only, 1-indexed. */
  month: number;
  day: number;
  /** Full Date of the next occurrence at local midnight. */
  next: Date;
  /** Whole days from today (0 = today). */
  daysAway: number;
  /** Years they'll turn on `next`, if we know their birth year. */
  turning: number | null;
};

/**
 * Given a list of contacts, return those with a birthday in the next `days`
 * days (inclusive of today), sorted by how soon.
 *
 * Handles:
 *   - ISO dates ("1990-05-15", "1990-05-15T00:00:00Z")
 *   - US format "MM/DD/YYYY" or "MM/DD"
 *   - Month-day only ("05-15", "05/15")
 *   - Year wrap (Dec 30 -> Jan 2 range)
 *   - Feb 29 birthdays in non-leap years (rolls to Feb 28)
 */
export function upcomingBirthdays(
  contacts: ContactSummary[],
  days: number,
  now: Date = new Date(),
): UpcomingBirthday[] {
  const out: UpcomingBirthday[] = [];
  const todayStart = startOfDay(now);
  const horizon = addDays(todayStart, days);

  for (const c of contacts) {
    const parsed = parseBirthday(c.dateOfBirth);
    if (!parsed) continue;

    const next = nextOccurrence(parsed.month, parsed.day, todayStart);
    if (next.getTime() > horizon.getTime()) continue;

    const daysAway = Math.round(
      (next.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000),
    );

    const turning =
      parsed.year != null ? next.getFullYear() - parsed.year : null;

    out.push({
      contact: c,
      month: parsed.month,
      day: parsed.day,
      next,
      daysAway,
      turning,
    });
  }

  out.sort((a, b) => a.daysAway - b.daysAway);
  return out;
}

export function contactDisplayName(c: ContactSummary): string {
  if (c.contactName && c.contactName.trim()) return c.contactName.trim();
  const first = c.firstNameLowerCase ?? "";
  const last = c.lastNameLowerCase ?? "";
  const joined = `${first} ${last}`.trim();
  return joined || c.email || c.phone || "Unknown contact";
}

function parseBirthday(
  raw: string | undefined | null,
): { month: number; day: number; year: number | null } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO-ish: YYYY-MM-DD or YYYY-MM-DDT...
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt]|$)/.exec(s);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (isValidMonthDay(month, day)) return { month, day, year };
  }

  // US: MM/DD/YYYY
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 30 ? 1900 : 2000;
    if (isValidMonthDay(month, day)) return { month, day, year };
  }

  // Month-day only: MM/DD or MM-DD
  m = /^(\d{1,2})[/-](\d{1,2})$/.exec(s);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (isValidMonthDay(month, day)) return { month, day, year: null };
  }

  // Fallback: let Date try.
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return {
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      year: d.getUTCFullYear(),
    };
  }

  return null;
}

function isValidMonthDay(month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function nextOccurrence(month: number, day: number, from: Date): Date {
  const year = from.getFullYear();
  let candidate = buildLocalDate(year, month, day);
  if (candidate.getTime() < from.getTime()) {
    candidate = buildLocalDate(year + 1, month, day);
  }
  return candidate;
}

function buildLocalDate(year: number, month: number, day: number): Date {
  // Feb 29 on non-leap years -> roll to Feb 28.
  const isFeb29 = month === 2 && day === 29;
  const effectiveDay = isFeb29 && !isLeapYear(year) ? 28 : day;
  return new Date(year, month - 1, effectiveDay);
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
