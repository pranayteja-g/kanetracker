import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { InrPipe } from '../shared/inr.pipe';

type Period = 'month' | 'last' | '3m' | 'year' | 'all';
interface Tx extends Transaction { t: number }
interface BudgetRow { name: string; spent: number; limit: number; pct: number; color: string; over: boolean }
interface TopCat { name: string; amount: number; color: string; pct: number }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, RouterLink, MatIconModule, InrPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  periods: { v: Period; l: string }[] = [
    { v: 'month', l: 'This month' },
    { v: 'last', l: 'Last month' },
    { v: '3m', l: '3 months' },
    { v: 'year', l: 'This year' },
    { v: 'all', l: 'All time' },
  ];
  period: Period = 'month';
  loaded = false;
  hasAny = false;

  income = 0;
  expense = 0;
  balance = 0;
  trend = '';
  top: TopCat[] = [];
  recent: Tx[] = [];
  budgets: BudgetRow[] = [];
  staleBackup = false;

  private all: Tx[] = [];            // newest first
  private colors = new Map<string, string>();

  constructor(private db: DexieService) {}

  async ngOnInit() {
    const [txs, cats, buds, lb] = await Promise.all([
      this.db.getTransactionsNewestFirst(), this.db.getAllCategories(), this.db.budgets.toArray(),
      this.db.getSetting<string>('lastBackup', ''),
    ]);
    this.all = txs.map(t => ({ ...t, t: new Date(t.date).getTime() }));
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.hasAny = this.all.length > 0;
    this.staleBackup = this.all.length >= 10 && (!lb || Date.now() - new Date(lb).getTime() > 30 * 864e5);
    this.budgets = this.buildBudgets(buds);
    this.compute();
    this.loaded = true;
  }

  private buildBudgets(buds: { category: string; limit: number }[]): BudgetRow[] {
    if (!buds.length) return [];
    const [from, to] = this.range('month');
    const spent = new Map<string, number>();
    for (const t of this.all) if (t.type === 'expense' && t.t >= from && t.t <= to) spent.set(t.category, (spent.get(t.category) || 0) + t.amount);
    return buds.map(b => {
      const s = spent.get(b.category) || 0;
      return { name: b.category, spent: s, limit: b.limit, pct: Math.min(100, (s / b.limit) * 100), color: this.color(b.category), over: s > b.limit };
    }).sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  }

  setPeriod(p: Period) {
    this.period = p;
    this.compute();
  }

  color(name: string) {
    return this.colors.get(name) || '#d4d4d4';
  }

  /** Single pass over the data; no refetch on period change. */
  private compute() {
    const [from, to] = this.range(this.period);
    const [lf, lt] = this.range('last');
    let inc = 0, exp = 0, lastExp = 0;
    const byCat = new Map<string, number>();
    const recent: Tx[] = [];

    for (const t of this.all) {
      if (t.t >= lf && t.t <= lt && t.type === 'expense') lastExp += t.amount;
      if (t.t < from || t.t > to) continue;
      if (t.type === 'income') inc += t.amount;
      else {
        exp += t.amount;
        byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
      }
      if (recent.length < 5) recent.push(t);
    }

    this.income = inc;
    this.expense = exp;
    this.balance = inc - exp;
    this.recent = recent;
    this.top = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amount]) => ({ name, amount, color: this.color(name), pct: exp ? (amount / exp) * 100 : 0 }));

    if (this.period === 'month' && lastExp > 0) {
      const ch = Math.round(((exp - lastExp) / lastExp) * 100);
      this.trend = ch === 0 ? 'Same spend as last month' : `${Math.abs(ch)}% ${ch > 0 ? 'more' : 'less'} spent than last month`;
    } else this.trend = '';
  }

  private range(p: Period): [number, number] {
    const n = new Date();
    const y = n.getFullYear(), m = n.getMonth();
    const end = (yy: number, mm: number) => new Date(yy, mm + 1, 0, 23, 59, 59, 999).getTime();
    switch (p) {
      case 'last': return [new Date(y, m - 1, 1).getTime(), end(y, m - 1)];
      case '3m': return [new Date(y, m - 2, 1).getTime(), end(y, m)];
      case 'year': return [new Date(y, 0, 1).getTime(), end(y, 11)];
      case 'all': return [0, Infinity];
      default: return [new Date(y, m, 1).getTime(), end(y, m)];
    }
  }
}
