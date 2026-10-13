export interface CardInfo { account: string; dueDay: number }

/** Next due date for a day-of-month (clamped to month length) and days from today. Pure. */
export function nextDue(dueDay: number, now: Date): { date: Date; days: number } {
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mk = (y: number, m: number) => new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate()));
  let d = mk(day0.getFullYear(), day0.getMonth());
  if (d < day0) d = mk(day0.getFullYear(), day0.getMonth() + 1);
  return { date: d, days: Math.round((d.getTime() - day0.getTime()) / 864e5) };
}
