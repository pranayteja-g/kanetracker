import { Transaction } from '../models/transaction.interface';
import { Trip, TripPlanLine } from '../models/trip.interface';

/** Pure trip maths. Everything takes `now` so it can be tested. Amounts are in the base currency unless noted. */
const DAY = 864e5;
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayNum = (d: Date) => Math.round(day0(d).getTime() / DAY);
const round2 = (n: number) => Math.round(n * 100) / 100;

export const MAX_TRIP_DAYS = 365;

export type TripState = 'upcoming' | 'active' | 'past';

export function tripDays(t: Pick<Trip, 'start' | 'end'>): number {
  return dayNum(new Date(t.end)) - dayNum(new Date(t.start)) + 1;
}

export interface Status {
  state: TripState;
  days: number;
  /** 1-based day of the trip (active only). */
  dayNo: number;
  /** Days remaining including today (active only). */
  daysLeft: number;
  /** Whole days until the first day (upcoming only). */
  daysToStart: number;
}

export function tripStatus(t: Trip, now: Date): Status {
  const days = tripDays(t);
  const today = dayNum(now), s = dayNum(new Date(t.start)), e = dayNum(new Date(t.end));
  if (today < s) return { state: 'upcoming', days, dayNo: 0, daysLeft: 0, daysToStart: s - today };
  if (today > e) return { state: 'past', days, dayNo: 0, daysLeft: 0, daysToStart: 0 };
  return { state: 'active', days, dayNo: today - s + 1, daysLeft: e - today + 1, daysToStart: 0 };
}

/** Trips whose dates include `date`, earliest start first. */
export function tripsOnDate(trips: Trip[], date: Date): Trip[] {
  const d = dayNum(date);
  return trips
    .filter(t => dayNum(new Date(t.start)) <= d && d <= dayNum(new Date(t.end)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export interface CatRow {
  category: string;
  planned: number;
  spent: number;
  left: number;
  pct: number;
  state: 'ok' | 'near' | 'over' | 'unplanned';
}

export interface TripSummary extends Status {
  /** Planned total in base currency. */
  planned: number;
  /** Planned total in the trip's own currency. */
  plannedTrip: number;
  spent: number;
  left: number;
  pct: number;
  perDayPlan: number;
  todayAllowance: number;
  todaySpent: number;
  todayLeft: number;
  /** Expected total if the pace so far continues (active, day 2+). */
  projected: number | null;
  /** Upcoming only: unpaid part of the plan spread over the months left. */
  savePerMonth: number | null;
  rows: CatRow[];
  daily: { date: Date; amount: number }[];
  /** Linked spending dated before the first or after the last day (e.g. pre-paid bookings). */
  outside: number;
}

export function planTotal(plan: TripPlanLine[]): number {
  return plan.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
}

export function summarizeTrip(t: Trip, txs: Transaction[], now: Date): TripSummary {
  const st = tripStatus(t, now);
  const mine = txs.filter(x => x.tripId === t.id && x.type === 'expense');
  const plannedTrip = planTotal(t.plan);
  const planned = round2(plannedTrip * t.rate);

  const s0 = dayNum(new Date(t.start));
  const today = dayNum(now);
  const daily = Array.from({ length: Math.min(st.days, MAX_TRIP_DAYS + 1) }, (_, i) => ({ date: new Date(new Date(t.start).getTime() + i * DAY), amount: 0 }));
  const byCat = new Map<string, number>();
  let spent = 0, outside = 0, todaySpent = 0, inRangeBeforeToday = 0, spentBeforeToday = 0;

  for (const x of mine) {
    const dn = dayNum(new Date(x.date));
    spent += x.amount;
    byCat.set(x.category, (byCat.get(x.category) || 0) + x.amount);
    const i = dn - s0;
    if (i >= 0 && i < daily.length) daily[i].amount += x.amount; else outside += x.amount;
    if (dn === today) todaySpent += x.amount;
    if (dn < today) { spentBeforeToday += x.amount; if (i >= 0) inRangeBeforeToday += x.amount; }
  }

  const rows: CatRow[] = [];
  const planned_ = new Map<string, number>();
  for (const l of t.plan) if (l.amount > 0) planned_.set(l.category, (planned_.get(l.category) || 0) + l.amount * t.rate);
  for (const [category, p] of [...planned_.entries()].sort((a, b) => b[1] - a[1])) {
    const sp = byCat.get(category) || 0, pct = p > 0 ? (sp / p) * 100 : 0;
    rows.push({ category, planned: round2(p), spent: round2(sp), left: round2(p - sp), pct, state: sp > p ? 'over' : pct >= 80 ? 'near' : 'ok' });
  }
  for (const [category, sp] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    if (!planned_.has(category)) rows.push({ category, planned: 0, spent: round2(sp), left: round2(-sp), pct: 0, state: 'unplanned' });
  }

  const left = round2(planned - spent);
  let todayAllowance = 0, todayLeft = 0, projected: number | null = null;
  if (st.state === 'active') {
    todayAllowance = Math.max(0, planned - spentBeforeToday) / st.daysLeft;
    todayLeft = todayAllowance - todaySpent;
    if (st.dayNo >= 2) {
      const rate = inRangeBeforeToday / (st.dayNo - 1);
      projected = spent + rate * (st.daysLeft - 1) + Math.max(0, rate - todaySpent);
    }
  }
  const months = Math.ceil(st.daysToStart / 30);
  const savePerMonth = st.state === 'upcoming' && months >= 1 && left > 0 ? left / months : null;

  return {
    ...st, planned, plannedTrip, spent: round2(spent), left, pct: planned > 0 ? (spent / planned) * 100 : 0,
    perDayPlan: st.days > 0 ? planned / st.days : 0,
    todayAllowance, todaySpent, todayLeft, projected, savePerMonth, rows, daily, outside: round2(outside),
  };
}

// ---------- planning helpers ----------
/** Rough share of a trip budget by category name. Unknown names get a small share. */
/** Categories made for trips. Added as normal expense categories so entries still show in History. */
export const TRIP_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Stay', color: '#6366f1' },
  { name: 'Flights', color: '#0ea5e9' },
  { name: 'Food', color: '#f97316' },
  { name: 'Local transport', color: '#14b8a6' },
  { name: 'Activities', color: '#ec4899' },
  { name: 'Shopping', color: '#a855f7' },
  { name: 'Other', color: '#78716c' },
];

const TEMPLATE: [RegExp, number][] = [
  [/stay|hotel|lodg|accommod|hostel|resort|room/i, 30],
  [/flight|airfare|airline|\btrain|\brail/i, 20],
  [/food|dining|restaurant|meal|eat|cafe|snack/i, 20],
  [/transport|travel|fuel|petrol|cab|taxi|bus|commute|toll|ride/i, 10],
  [/activit|entertain|sight|ticket|fun|tour|adventure/i, 10],
  [/shop|souvenir|gift|cloth/i, 7],
  [/other|misc|general/i, 3],
];
const NEUTRAL = 3;
/** Categories that do not belong in a trip plan by default. */
const NOT_TRIP = /rent|emi|loan|insurance|tax|invest|saving|subscription|school|tuition|bill|utilit|electric|recharge|medic|health/i;

export function templateWeights(cats: string[]): Record<string, number> {
  const w: Record<string, number> = {};
  for (const c of cats) w[c] = TEMPLATE.find(([re]) => re.test(c))?.[1] ?? (NOT_TRIP.test(c) ? 0 : NEUTRAL);
  return w;
}

/** Category shares of what past trips actually cost. null when there is nothing to learn from. */
export function pastTripWeights(trips: Trip[], txs: Transaction[], now: Date): Record<string, number> | null {
  const past = new Set(trips.filter(t => tripStatus(t, now).state === 'past').map(t => t.id));
  const w: Record<string, number> = {};
  let total = 0;
  for (const x of txs) {
    if (x.type !== 'expense' || x.tripId == null || !past.has(x.tripId)) continue;
    w[x.category] = (w[x.category] || 0) + x.amount;
    total += x.amount;
  }
  return total > 0 ? w : null;
}

/** Average spend per day over finished trips (base currency), or null. */
export function pastTripDailyAvg(trips: Trip[], txs: Transaction[], now: Date): number | null {
  const past = trips.filter(t => tripStatus(t, now).state === 'past');
  if (!past.length) return null;
  const ids = new Set(past.map(t => t.id));
  const spent = txs.filter(x => x.type === 'expense' && x.tripId != null && ids.has(x.tripId)).reduce((s, x) => s + x.amount, 0);
  const days = past.reduce((s, t) => s + tripDays(t), 0);
  return spent > 0 && days > 0 ? spent / days : null;
}

/**
 * Spread `total` over categories by weight (weights <= 0 get nothing; all-zero → even).
 * Amounts are rounded to 2 decimals and always add up to exactly `total`.
 */
export function splitTotal(total: number, cats: string[], weights: Record<string, number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  cats.forEach(c => (out[c] = 0));
  if (!(total > 0) || !cats.length) return out;
  let w = cats.map(c => Math.max(0, weights?.[c] ?? 0));
  let sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) { w = cats.map(() => 1); sum = cats.length; }
  const cents = Math.round(total * 100);
  const raw = w.map(x => (x / sum) * cents);
  const base = raw.map(Math.floor);
  let rest = cents - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length) { base[order[k][1]]++; rest--; }
  cats.forEach((c, i) => (out[c] = base[i] / 100));
  return out;
}
