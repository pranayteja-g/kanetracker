import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { InrPipe } from '../shared/inr.pipe';
import { QuickAddComponent } from '../quick-add/quick-add.component';
import { Category } from '../models/category.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Insight, RecurringSuggestion, buildInsights, detectRecurring } from '../shared/insights';
import { fmtMoney } from '../shared/currency';
import { TripSummary, summarizeTrip, tripStatus } from '../shared/trips';
import { Trip } from '../models/trip.interface';
import { computeBalances, totals } from '../shared/splits';
import { accountFlows, balances } from '../shared/accounts';
import { CardInfo, nextDue } from '../shared/cards';
import { Goal } from '../shared/goals';

interface TripCard { id: number; name: string; s: TripSummary; row: BudgetRow }

type Period = 'month' | 'last' | '3m' | 'year' | 'all';
interface Tx extends Transaction { t: number }
interface BudgetRow { name: string; spent: number; limit: number; pct: number; color: string; over: boolean }
interface TopCat { name: string; amount: number; color: string; pct: number }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, RouterLink, MatIconModule, InrPipe, QuickAddComponent],
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
  tripCards: TripCard[] = [];
  rawTxs: Transaction[] = [];
  catList: Category[] = [];
  acctTotal: number | null = null;
  dues: { account: string; days: number; owed: number }[] = [];
  goalsLine = '';
  owe = { owedToMe: 0, iOwe: 0 };
  staleBackup = false;
  newSinceBackup = 0;
  insights: Insight[] = [];
  suggestions: RecurringSuggestion[] = [];
  private dismissed = new Set<string>();

  private all: Tx[] = [];            // newest first
  private colors = new Map<string, string>();

  constructor(private db: DexieService, private snack: MatSnackBar) {}

  async ngOnInit() {
    const [txs, cats, buds, lb, lbCount] = await Promise.all([
      this.db.getTransactionsNewestFirst(), this.db.getAllCategories(), this.db.budgets.toArray(),
      this.db.getSetting<string>('lastBackup', ''),
      this.db.getSetting<number>('lastBackupCount', 0),
    ]);
    this.rawTxs = txs;
    this.catList = cats;
    this.all = txs.map(t => ({ ...t, t: new Date(t.date).getTime() }));
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.hasAny = this.all.length > 0;
    const age = lb ? (Date.now() - new Date(lb).getTime()) / 864e5 : Infinity;
    this.newSinceBackup = Math.max(0, this.all.length - (lbCount || 0));
    // never backed up, 30+ days old, or lots of new entries (2+ weeks old, or 50+ entries any time)
    this.staleBackup = this.all.length >= 10 && (!lb || age > 30 || this.newSinceBackup >= 50 || (age > 14 && this.newSinceBackup >= 15));
    this.budgets = this.buildBudgets(buds);
    this.compute();
    try {
      const sets = await this.db.getSetting<any[]>('settlements', []);
      this.owe = totals(computeBalances(txs, sets));
      const [op, tr, list] = await Promise.all([this.db.getSetting<Record<string, number>>('accountOpening', {}), this.db.getSetting<any[]>('transfers', []), this.db.getSetting<string[]>('accounts', [])]);
      if (Object.keys(op).length) {
        const fl = accountFlows(txs, tr);
        const names = new Set([...list, ...Object.keys(op), ...Object.keys(fl)]);
        const bal = balances([...names], op, fl);
        this.acctTotal = Object.values(bal).reduce((s, v) => s + v, 0);
        const cards = await this.db.getSetting<CardInfo[]>('cards', []);
        const now2 = new Date();
        this.dues = cards.map(c => ({ account: c.account, days: nextDue(c.dueDay, now2).days, owed: -(bal[c.account] || 0) }))
          .filter(d => d.owed > 0 && d.days <= 7).sort((a, b) => a.days - b.days);
      }
      const goals = await this.db.getSetting<Goal[]>('goals', []);
      if (goals.length) {
        const sum = goals.reduce((s, g) => s + g.saved.reduce((x, c) => x + c.amount, 0), 0);
        this.goalsLine = `${goals.length} goal${goals.length === 1 ? '' : 's'} · ${fmtMoney(sum)} saved`;
      }
    } catch { /* never block Home */ }
    try {
      const now = new Date();
      const trips: Trip[] = await this.db.getTrips();
      this.tripCards = trips.filter(t => tripStatus(t, now).state === 'active').map(t => {
        const s = summarizeTrip(t, txs, now);
        return { id: t.id!, name: t.name, s, row: { name: t.name, spent: s.spent, limit: s.planned, pct: s.planned > 0 ? Math.min(100, (s.spent / s.planned) * 100) : 0, color: '#6366f1', over: s.planned > 0 && s.spent > s.planned } };
      });
    } catch (e) {
      console.error('Trips failed', e);
    }
    try {
      const [rules, dis] = await Promise.all([this.db.recurring.toArray(), this.db.getSetting<string[]>('dismissedRecurring', [])]);
      this.dismissed = new Set(dis);
      const now = new Date();
      this.insights = buildInsights(txs, buds, rules, now, n => fmtMoney(n));
      this.suggestions = detectRecurring(txs, rules, this.dismissed, now);
    } catch (e) {
      console.error('Insights failed', e); // never block Home
    }
    this.loaded = true;
  }

  icon(i: Insight) {
    return i.kind === 'forecast' ? 'trending_up' : i.kind === 'budget' ? 'savings' : i.kind === 'anomaly' ? 'priority_high' : 'show_chart';
  }

  freqLabel(f: string) { return f === 'weekly' ? 'every week' : f === 'monthly' ? 'every month' : 'every year'; }

  async addRule(s: RecurringSuggestion) {
    await this.db.recurring.add({
      type: s.type, amount: s.amount, category: s.category, description: s.label, account: s.account,
      freq: s.freq, dom: s.dom, nextDate: s.nextDate.toISOString(), active: true,
    });
    this.suggestions = this.suggestions.filter(x => x.key !== s.key);
    this.snack.open('Recurring rule added', undefined, { duration: 2000 });
  }

  async dismissRule(s: RecurringSuggestion) {
    this.dismissed.add(s.key);
    await this.db.setSetting('dismissedRecurring', [...this.dismissed]);
    this.suggestions = this.suggestions.filter(x => x.key !== s.key);
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

  get tripRows(): BudgetRow[] {
    return this.tripCards.filter(c => c.s.planned > 0).map(c => c.row);
  }

  fmt(n: number) { return fmtMoney(n); }

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
