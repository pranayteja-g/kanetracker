import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { BarController, BarElement, CategoryScale, Chart, ChartConfiguration, ChartData, Legend, LinearScale, Tooltip } from 'chart.js';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { InrPipe } from '../shared/inr.pipe';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

type Preset = '7d' | 'month' | '3m' | '1y' | 'all' | 'custom';
interface Row { name: string; amount: number; color: string; pct: number }
interface Tx { t: number; amount: number; type: 'income' | 'expense'; category: string }

const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date) => startOfDay(d) + DAY - 1;
const compact = (v: number | string) => {
  const n = Number(v);
  return n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${+(n / 1e3).toFixed(1)}k` : `₹${n}`;
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, BaseChartDirective, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top"><h1>Stats</h1></header>

      <div class="chips">
        <button *ngFor="let p of presets; trackBy: byKey" class="chip" [class.on]="p.k === preset" (click)="setPreset(p.k)">{{ p.l }}</button>
      </div>

      <div class="custom" *ngIf="preset === 'custom'">
        <label><span class="label">From</span><input type="date" [value]="from" [max]="to" (change)="onDate('from', $event)" /></label>
        <label><span class="label">To</span><input type="date" [value]="to" [min]="from" (change)="onDate('to', $event)" /></label>
      </div>

      <section class="hero">
        <div><span class="label">Spent</span><b>{{ expense | inr }}</b></div>
        <div><span class="label">Income</span><b class="inc">{{ income | inr }}</b></div>
        <div><span class="label">Net</span><b [class.neg]="income - expense < 0">{{ income - expense | inr }}</b></div>
      </section>

      <ng-container *ngIf="hasData; else none">
        <section class="sec">
          <div class="row-h"><h2>{{ daily ? 'Daily' : 'Monthly' }}</h2></div>
          <div class="chart"><canvas baseChart [data]="chart" [options]="opts" type="bar"></canvas></div>
        </section>

        <section class="sec" *ngIf="cats.length">
          <div class="row-h"><h2>By category</h2></div>
          <div class="cat" *ngFor="let c of cats; trackBy: byName">
            <div class="cat-h"><span><i [style.background]="c.color"></i>{{ c.name }}</span><b>{{ c.amount | inr }} <em>{{ c.pct | number:'1.0-0' }}%</em></b></div>
            <div class="bar"><div [style.width.%]="c.pct" [style.background]="c.color"></div></div>
          </div>
        </section>
      </ng-container>
      <ng-template #none><p class="muted empty">No data for this range</p></ng-template>
    </div>
  `,
  styles: [`
    .custom { display: flex; gap: 8px; margin-top: 12px; }
    .custom label { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .custom input { min-height: 44px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); font: inherit; font-size: 16px; }
    .hero { display: flex; justify-content: space-between; gap: 8px; padding: 24px 0 4px; }
    .hero div { display: flex; flex-direction: column; gap: 2px; }
    .hero b { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .neg { color: var(--k-neg); }
    .chart { position: relative; height: 220px; }
    .cat { margin-bottom: 14px; }
    .cat-h { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
    .cat-h span { display: flex; align-items: center; gap: 8px; }
    .cat-h i { width: 8px; height: 8px; border-radius: 50%; }
    .cat-h b { font-weight: 500; font-variant-numeric: tabular-nums; }
    .cat-h em { font-style: normal; color: var(--k-muted); font-size: 12px; margin-left: 4px; }
    .bar { height: 4px; background: var(--k-line); border-radius: 2px; overflow: hidden; }
    .bar div { height: 100%; }
    .empty { text-align: center; padding: 48px 0; }
  `],
})
export class AnalyticsComponent implements OnInit {
  private dark = matchMedia('(prefers-color-scheme: dark)').matches;
  presets: { k: Preset; l: string }[] = [
    { k: '7d', l: '7 days' },
    { k: 'month', l: 'This month' },
    { k: '3m', l: '3 months' },
    { k: '1y', l: 'Year' },
    { k: 'all', l: 'All' },
    { k: 'custom', l: 'Custom' },
  ];
  preset: Preset = 'month';
  from = '';
  to = '';
  loaded = false;
  hasData = false;
  daily = false;

  income = 0;
  expense = 0;
  cats: Row[] = [];
  chart: ChartData<'bar'> = { labels: [], datasets: [] };

  readonly opts: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: v => compact(v), maxTicksLimit: 5 } },
    },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: c => `${c.dataset.label}: ₹${Number(c.parsed.y).toLocaleString('en-IN')}` } },
    },
  };

  private txs: Tx[] = [];
  private colors = new Map<string, string>();

  constructor(private db: DexieService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    const [all, cats] = await Promise.all([this.db.getAllTransactions(), this.db.getAllCategories()]);
    this.txs = all
      .map(t => ({ t: new Date(t.date).getTime(), amount: t.amount, type: t.type, category: t.category }))
      .filter(t => !isNaN(t.t));
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.setPreset('month');
    this.loaded = true;
    this.cdr.markForCheck();
  }

  byKey = (_: number, p: { k: string }) => p.k;
  byName = (_: number, c: Row) => c.name;

  setPreset(p: Preset) {
    this.preset = p;
    const n = new Date();
    const y = n.getFullYear(), m = n.getMonth();
    if (p === 'custom') {
      if (!this.from) { this.from = toInput(new Date(y, m, 1)); this.to = toInput(n); }
    } else {
      const start = p === '7d' ? new Date(y, m, n.getDate() - 6)
        : p === 'month' ? new Date(y, m, 1)
        : p === '3m' ? new Date(y, m - 2, 1)
        : p === '1y' ? new Date(y - 1, m, n.getDate() + 1)
        : new Date(this.txs.length ? Math.min(...this.txs.map(t => t.t)) : n.getTime());
      this.from = toInput(start);
      this.to = toInput(n);
    }
    this.compute();
  }

  onDate(which: 'from' | 'to', e: Event) {
    const d = fromInput((e.target as HTMLInputElement).value);
    if (!d) return;
    this[which] = toInput(d);
    if (this.from > this.to) [this.from, this.to] = [this.to, this.from];   // never an inverted range
    this.compute();
  }

  private compute() {
    const a = fromInput(this.from), b = fromInput(this.to);
    if (!a || !b) return;
    const lo = startOfDay(a), hi = endOfDay(b);
    this.daily = hi - lo <= 45 * DAY;

    let inc = 0, exp = 0;
    const byCat = new Map<string, number>();
    const buckets = new Map<string, { i: number; e: number }>();
    this.seed(a, b, buckets);

    for (const t of this.txs) {
      if (t.t < lo || t.t > hi) continue;
      const bk = buckets.get(this.key(new Date(t.t)));
      if (t.type === 'income') { inc += t.amount; if (bk) bk.i += t.amount; }
      else {
        exp += t.amount;
        byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
        if (bk) bk.e += t.amount;
      }
    }

    this.income = inc;
    this.expense = exp;
    this.hasData = inc + exp > 0;
    this.cats = [...byCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)
      .map(([name, amount]) => ({ name, amount, color: this.colors.get(name) || '#d4d4d4', pct: exp ? (amount / exp) * 100 : 0 }));

    const vals = [...buckets.values()];
    this.chart = {
      labels: [...buckets.keys()].map(k => this.label(k)),
      datasets: [
        { label: 'Spent', data: vals.map(v => v.e), backgroundColor: this.dark ? '#e5e5e5' : '#171717', borderRadius: 3 },
        { label: 'Income', data: vals.map(v => v.i), backgroundColor: '#86c9a0', borderRadius: 3 },
      ],
    };
    this.cdr.markForCheck();
  }

  /** Pre-create every bucket, capped so a huge range can never loop for long. */
  private seed(a: Date, b: Date, out: Map<string, { i: number; e: number }>) {
    const cur = this.daily ? new Date(a) : new Date(a.getFullYear(), a.getMonth(), 1);
    for (let n = 0; cur <= b && n < 400; n++) {
      out.set(this.key(cur), { i: 0, e: 0 });
      if (this.daily) cur.setDate(cur.getDate() + 1); else cur.setMonth(cur.getMonth() + 1);
    }
  }

  private key(d: Date) {
    return this.daily ? toInput(d) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  private label(k: string) {
    const [y, m, d] = k.split('-').map(Number);
    return this.daily
      ? new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
}
