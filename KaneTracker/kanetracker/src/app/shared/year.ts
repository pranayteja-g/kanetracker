import { Transaction } from '../models/transaction.interface';

export interface MonthRow { m: number; income: number; spent: number }
export interface YearSummary {
  year: number; income: number; spent: number; saved: number; rate: number | null;
  months: MonthRow[]; top: { name: string; amount: number; pct: number }[];
  avgMonthly: number; maxMonth: number; bigMonth: number | null; bestMonth: number | null; count: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calendar-year roll-up in the base currency. Pure. */
export function summarizeYear(txs: Transaction[], year: number, now = new Date()): YearSummary {
  const months: MonthRow[] = Array.from({ length: 12 }, (_, m) => ({ m, income: 0, spent: 0 }));
  const cat = new Map<string, number>();
  let count = 0;
  for (const t of txs) {
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    count++;
    const row = months[d.getMonth()];
    if (t.type === 'income') row.income += t.amount;
    else { row.spent += t.amount; cat.set(t.category, (cat.get(t.category) || 0) + t.amount); }
  }
  months.forEach(m => { m.income = r2(m.income); m.spent = r2(m.spent); });
  const income = r2(months.reduce((s, m) => s + m.income, 0));
  const spent = r2(months.reduce((s, m) => s + m.spent, 0));
  // months elapsed: all 12 for past years, up to the current month this year
  const elapsed = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;
  const active = months.slice(0, Math.max(elapsed, 0)).filter(m => m.income || m.spent);
  const top = [...cat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, amount]) => ({ name, amount: r2(amount), pct: spent > 0 ? (amount / spent) * 100 : 0 }));
  let bigMonth: number | null = null, bestMonth: number | null = null;
  for (const m of active) {
    if (bigMonth === null || m.spent > months[bigMonth].spent) bigMonth = m.m;
    if (m.income > 0 && (bestMonth === null || m.income - m.spent > months[bestMonth].income - months[bestMonth].spent)) bestMonth = m.m;
  }
  return {
    year, income, spent, saved: r2(income - spent), rate: income > 0 ? ((income - spent) / income) * 100 : null,
    months, top, avgMonthly: elapsed > 0 ? r2(spent / elapsed) : 0, maxMonth: Math.max(1, ...months.map(m => Math.max(m.income, m.spent))),
    bigMonth, bestMonth, count,
  };
}
