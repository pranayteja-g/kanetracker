import { Budget } from '../models/budget.interface';
import { Freq, Recurring } from '../models/recurring.interface';
import { Transaction } from '../models/transaction.interface';
import { words } from './categorize';
import { advance } from './utils';

/**
 * On-device analytics: forecasts, anomalies, trends, recurring detection.
 * Plain statistics (medians, MAD, trimmed means), no network, no ML library.
 * All functions are pure and take `now` so they are testable.
 */
export interface Insight {
  kind: 'forecast' | 'budget' | 'anomaly' | 'trend';
  level: 'info' | 'warn';
  text: string;
}

const DAY = 864e5;
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (a: number[], q: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

interface Rate { perDay: number; sd: number }

/** Typical daily spend over the last `days` completed days. One-off big days are clipped at the 90th percentile. */
function dailyRate(txs: Transaction[], now: Date, days: number, pick: (t: Transaction) => boolean): Rate {
  const end = day0(now).getTime();
  const start = end - days * DAY;
  const daily = new Array<number>(days).fill(0);
  for (const t of txs) {
    // trip spending is not "everyday" pace: keep it out of rates so a holiday doesn't skew forecasts
    if (t.type !== 'expense' || t.recurringId || t.tripId || !pick(t)) continue;
    const ts = day0(new Date(t.date)).getTime();
    if (ts >= start && ts < end) daily[Math.round((ts - start) / DAY)] += t.amount;
  }
  const cap = quantile(daily, 0.9);
  const clipped = daily.map(x => (cap > 0 ? Math.min(x, cap) : x));
  return { perDay: mean(clipped), sd: sd(clipped) };
}

function upcoming(rules: Recurring[], now: Date, pick: (r: Recurring) => boolean): number {
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  const today = day0(now).getTime();
  let sum = 0;
  for (const r of rules) {
    if (!r.active || r.type !== 'expense' || !pick(r)) continue;
    let d = new Date(r.nextDate);
    const stop = r.endDate ? new Date(r.endDate).getTime() : Infinity;
    for (let i = 0; i < 40 && d.getTime() <= eom && d.getTime() <= stop; i++) {
      if (d.getTime() > today) sum += r.amount;
      d = advance(d, r.freq, r.dom);
    }
  }
  return sum;
}

const inMonth = (t: Transaction, y: number, m: number) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; };

export interface Forecast { ok: boolean; mtd: number; projected: number; low: number; high: number; lastMonth: number; daysLeft: number }

export function forecastMonth(txs: Transaction[], rules: Recurring[], now: Date): Forecast {
  const y = now.getFullYear(), m = now.getMonth();
  const exp = txs.filter(t => t.type === 'expense');
  const mtd = exp.filter(t => inMonth(t, y, m) && new Date(t.date) <= new Date(day0(now).getTime() + DAY - 1)).reduce((s, t) => s + t.amount, 0);
  const pm = new Date(y, m - 1, 1);
  const lastMonth = exp.filter(t => inMonth(t, pm.getFullYear(), pm.getMonth())).reduce((s, t) => s + t.amount, 0);
  const dim = new Date(y, m + 1, 0).getDate();
  const daysLeft = dim - now.getDate();

  const recent = exp.filter(t => day0(new Date(t.date)).getTime() >= day0(now).getTime() - 28 * DAY && !t.recurringId && !t.tripId);
  const first = exp.length ? Math.min(...exp.map(t => new Date(t.date).getTime())) : Infinity;
  const ok = recent.length >= 8 && first <= day0(now).getTime() - 14 * DAY;
  if (!ok) return { ok, mtd, projected: mtd, low: mtd, high: mtd, lastMonth, daysLeft };

  const r = dailyRate(txs, now, 28, () => true);
  const fixed = upcoming(rules, now, () => true);
  const projected = mtd + r.perDay * daysLeft + fixed;
  const band = 1.28 * r.sd * Math.sqrt(daysLeft);
  return { ok, mtd, projected, low: Math.max(mtd + fixed, projected - band), high: projected + band, lastMonth, daysLeft };
}

export interface Anomaly { tx: Transaction; typical: number; ratio: number }

export function findAnomalies(txs: Transaction[], now: Date, lookbackDays = 14): Anomaly[] {
  const since = day0(now).getTime() - lookbackDays * DAY;
  const hist = txs.filter(t => t.type === 'expense' && !t.recurringId && !t.tripId && day0(new Date(t.date)).getTime() >= day0(now).getTime() - 180 * DAY);
  const byCat = new Map<string, Transaction[]>();
  hist.forEach(t => byCat.set(t.category, [...(byCat.get(t.category) || []), t]));
  const out: Anomaly[] = [];
  for (const t of hist) {
    if (new Date(t.date).getTime() < since) continue;
    const peers = (byCat.get(t.category) || []).filter(p => p !== t).map(p => p.amount);
    if (peers.length < 8) continue;
    const med = median(peers);
    const mad = median(peers.map(x => Math.abs(x - med)));
    const z = mad > 0 ? (0.6745 * (t.amount - med)) / mad : t.amount > 1.5 * quantile(peers, 0.9) ? 99 : 0;
    if (z > 3.5 && t.amount >= 1.5 * med && med > 0) out.push({ tx: t, typical: med, ratio: t.amount / med });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, 2);
}

export interface BudgetRisk { category: string; limit: number; spent: number; kind: 'near' | 'will-break'; breachDate?: Date }

export function budgetRisks(txs: Transaction[], budgets: Budget[], rules: Recurring[], now: Date): BudgetRisk[] {
  const y = now.getFullYear(), m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const daysLeft = dim - now.getDate();
  const out: BudgetRisk[] = [];
  for (const b of budgets) {
    const spent = txs.filter(t => t.type === 'expense' && t.category === b.category && inMonth(t, y, m)).reduce((s, t) => s + t.amount, 0);
    if (spent > b.limit) continue; // already visible as over on Home
    const rate = dailyRate(txs, now, 28, t => t.category === b.category).perDay;
    const fixed = upcoming(rules, now, r => r.category === b.category);
    const proj = spent + rate * daysLeft + fixed;
    if (proj > b.limit && daysLeft > 0) {
      const need = rate > 0 ? Math.ceil((b.limit - spent) / rate) : daysLeft;
      out.push({ category: b.category, limit: b.limit, spent, kind: 'will-break', breachDate: new Date(day0(now).getTime() + Math.min(need, daysLeft) * DAY) });
    } else if (spent >= 0.8 * b.limit) out.push({ category: b.category, limit: b.limit, spent, kind: 'near' });
  }
  return out;
}

export interface Trend { category: string; cur: number; prev: number; pct: number }

/** Category spend so far this month vs the same days last month. */
export function biggestTrend(txs: Transaction[], now: Date): { up?: Trend; down?: Trend } {
  const d = now.getDate();
  if (d < 7) return {};
  const y = now.getFullYear(), m = now.getMonth();
  const pm = new Date(y, m - 1, 1);
  const cur = new Map<string, number>(), prev = new Map<string, number>();
  let prevMonthTotal = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || t.tripId) continue;
    const dt = new Date(t.date);
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() <= d) cur.set(t.category, (cur.get(t.category) || 0) + t.amount);
    if (dt.getFullYear() === pm.getFullYear() && dt.getMonth() === pm.getMonth()) {
      prevMonthTotal += t.amount;
      if (dt.getDate() <= d) prev.set(t.category, (prev.get(t.category) || 0) + t.amount);
    }
  }
  if (prevMonthTotal <= 0) return {};
  const floor = 0.05 * prevMonthTotal;
  let up: Trend | undefined, down: Trend | undefined;
  for (const c of new Set([...cur.keys(), ...prev.keys()])) {
    const a = cur.get(c) || 0, b = prev.get(c) || 0;
    if (b <= 0) continue;
    const pct = ((a - b) / b) * 100, delta = a - b;
    if (delta >= floor && pct >= 30 && (!up || delta > up.cur - up.prev)) up = { category: c, cur: a, prev: b, pct };
    if (-delta >= floor && pct <= -30 && (!down || -delta > down.prev - down.cur)) down = { category: c, cur: a, prev: b, pct };
  }
  return { up, down };
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function buildInsights(txs: Transaction[], budgets: Budget[], rules: Recurring[], now: Date, money: (n: number) => string): Insight[] {
  const out: Insight[] = [];
  const f = forecastMonth(txs, rules, now);
  if (f.ok && f.daysLeft > 0) {
    const vs = f.lastMonth > 0 ? ` Last month: ${money(f.lastMonth)}.` : '';
    out.push({
      kind: 'forecast', level: f.lastMonth > 0 && f.projected > f.lastMonth * 1.15 ? 'warn' : 'info',
      text: `On track to spend about ${money(Math.round(f.projected))} this month (${money(Math.round(f.low))} to ${money(Math.round(f.high))}).${vs}`,
    });
  }
  for (const r of budgetRisks(txs, budgets, rules, now).slice(0, 2)) {
    out.push({
      kind: 'budget', level: 'warn',
      text: r.kind === 'will-break'
        ? `${r.category} may pass its ${money(r.limit)} limit around ${fmtDay(r.breachDate!)}.`
        : `${r.category} is at ${Math.round((r.spent / r.limit) * 100)}% of its limit.`,
    });
  }
  for (const a of findAnomalies(txs, now)) {
    out.push({
      kind: 'anomaly', level: 'warn',
      text: `${a.tx.description || a.tx.category} ${money(a.tx.amount)} on ${fmtDay(new Date(a.tx.date))} is ${a.ratio >= 10 ? Math.round(a.ratio) : a.ratio.toFixed(1)}× your usual ${a.tx.category} (${money(Math.round(a.typical))}).`,
    });
  }
  const t = biggestTrend(txs, now);
  if (t.up) out.push({ kind: 'trend', level: 'info', text: `${t.up.category} is up ${Math.round(t.up.pct)}% vs the same days last month (${money(Math.round(t.up.cur))}).` });
  else if (t.down) out.push({ kind: 'trend', level: 'info', text: `${t.down.category} is down ${Math.round(-t.down.pct)}% vs the same days last month.` });
  return out;
}

// ---------- recurring detection ----------
export interface RecurringSuggestion {
  key: string;
  label: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  freq: Freq;
  count: number;
  account?: string;
  dom: number;
  nextDate: Date;
}

const merchantKey = (desc: string) => words(desc).slice(0, 2).join(' ');
const mode = <T>(a: T[]) => {
  const c = new Map<T, number>();
  a.forEach(x => c.set(x, (c.get(x) || 0) + 1));
  return [...c.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
};

export function detectRecurring(txs: Transaction[], rules: Recurring[], dismissed: Set<string>, now: Date): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.recurringId || !t.description) continue;
    const k = merchantKey(t.description);
    if (!k) continue;
    const key = `${t.type}|${k}`;
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  const today = day0(now).getTime();
  const out: RecurringSuggestion[] = [];

  for (const [key, list] of groups) {
    if (dismissed.has(key)) continue;
    // one point per day
    const byDay = new Map<number, Transaction>();
    list.forEach(t => byDay.set(day0(new Date(t.date)).getTime(), t));
    const pts = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
    if (pts.length < 3) continue;
    const gaps = pts.slice(1).map((p, i) => Math.round((p[0] - pts[i][0]) / DAY));
    const med = median(gaps);
    let freq: Freq | null = null, tol = 0;
    if (med >= 6 && med <= 8) { freq = 'weekly'; tol = 1; }
    else if (med >= 27 && med <= 34) { freq = 'monthly'; tol = 4; }
    else if (med >= 350 && med <= 380) { freq = 'yearly'; tol = 10; }
    if (!freq) continue;
    const expected = freq === 'weekly' ? 7 : freq === 'monthly' ? 30.5 : 365;
    const okGaps = gaps.filter(g => Math.abs(g - expected) <= tol + (freq === 'monthly' ? 0 : 0)).length;
    if (okGaps < 2 || okGaps / gaps.length < 0.75) continue;

    const amounts = pts.map(p => p[1].amount);
    const amed = median(amounts);
    if (amounts.filter(a => Math.abs(a - amed) <= 0.35 * amed).length / amounts.length < 0.7) continue;

    const lastTs = pts[pts.length - 1][0];
    if (today - lastTs > expected * 1.6 * DAY) continue; // stopped

    const last = pts[pts.length - 1][1];
    const type = last.type, category = mode(list.map(t => t.category)) as string;
    const dom = new Date(lastTs).getDate();
    const sameFreq = (r: Recurring) => r.type === type && r.freq === freq && (merchantKey(r.description) === key.split('|')[1] || (r.category === category && Math.abs(r.amount - amed) <= 0.25 * amed));
    if (rules.some(sameFreq)) continue;

    let next = advance(new Date(lastTs), freq, dom);
    while (next.getTime() <= today) next = advance(next, freq, dom);
    out.push({
      key, label: last.description, type, category, amount: Math.round(amed * 100) / 100, freq, count: pts.length,
      account: mode(list.map(t => t.account).filter(Boolean) as string[]), dom, nextDate: next,
    });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 3);
}
