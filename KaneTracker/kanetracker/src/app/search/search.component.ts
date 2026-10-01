import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog/transaction-detail-dialog.component';
import { InrPipe } from '../shared/inr.pipe';

type TypeF = '' | 'expense' | 'income';
type DateF = 'any' | 'today' | '7d' | 'month' | 'year' | 'custom';
type Sort = 'new' | 'old' | 'high' | 'low' | 'cat';
interface Item { tx: Transaction; t: number; text: string }

const DAY = 864e5;
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).getTime() : null;
};

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatIconModule, InrPipe],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, OnDestroy {
  types: { v: TypeF; l: string }[] = [{ v: '', l: 'All' }, { v: 'expense', l: 'Expenses' }, { v: 'income', l: 'Income' }];
  dates: { v: DateF; l: string }[] = [
    { v: 'any', l: 'Any time' }, { v: 'today', l: 'Today' }, { v: '7d', l: '7 days' },
    { v: 'month', l: 'This month' }, { v: 'year', l: 'This year' }, { v: 'custom', l: 'Custom' },
  ];
  sorts: { v: Sort; l: string }[] = [
    { v: 'new', l: 'Newest' }, { v: 'old', l: 'Oldest' }, { v: 'high', l: 'Highest' }, { v: 'low', l: 'Lowest' }, { v: 'cat', l: 'Category' },
  ];

  query = '';
  type: TypeF = '';
  date: DateF = 'any';
  from = '';
  to = '';
  category = '';
  min: number | null = null;
  max: number | null = null;
  sort: Sort = 'new';
  more = false;

  categories: Category[] = [];
  results: Item[] = [];
  shown: Item[] = [];
  income = 0;
  expense = 0;
  loaded = false;
  limit = 50;

  private items: Item[] = [];
  private colors = new Map<string, string>();
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private db: DexieService, private dialog: MatDialog) {}

  async ngOnInit() {
    await this.load();
    this.loaded = true;
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  private async load() {
    const [txs, cats] = await Promise.all([this.db.getAllTransactions(), this.db.getAllCategories()]);
    this.categories = cats;
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.items = txs.map(tx => ({ tx, t: new Date(tx.date).getTime(), text: `${tx.description} ${tx.category} ${tx.account || ""} ${(tx.tags || []).join(" ")}`.toLowerCase() }));
    this.run();
  }

  get active(): boolean {
    return !!(this.query || this.type || this.date !== 'any' || this.category || this.min != null || this.max != null);
  }

  get hasMore() {
    return this.results.length > this.limit;
  }

  color(name: string) {
    return this.colors.get(name) || '#d4d4d4';
  }

  onQuery() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 120);
  }

  setType(v: TypeF) { this.type = v; this.run(); }

  setDate(v: DateF) {
    this.date = v;
    if (v === 'custom' && !this.from) {
      const n = new Date();
      this.from = this.iso(new Date(n.getFullYear(), n.getMonth(), 1));
      this.to = this.iso(n);
    }
    this.run();
  }

  clear() {
    this.query = ''; this.type = ''; this.date = 'any'; this.category = '';
    this.min = null; this.max = null; this.sort = 'new'; this.from = ''; this.to = '';
    this.run();
  }

  showMore() {
    this.limit += 50;
    this.shown = this.results.slice(0, this.limit);
  }

  open(item: Item) {
    this.dialog
      .open(TransactionDetailDialogComponent, { width: '500px', maxWidth: '95vw', data: { transaction: item.tx } })
      .afterClosed()
      .subscribe(r => (r?.updated || r?.deleted) && this.load());
  }

  /** All filtering is in-memory: instant, and never drops a keystroke. */
  run() {
    const q = this.query.trim().toLowerCase();
    const [lo, hi] = this.range();
    const min = this.min != null && !isNaN(this.min) ? this.min : null;
    const max = this.max != null && !isNaN(this.max) ? this.max : null;

    const out = this.items.filter(i =>
      (!q || i.text.includes(q)) &&
      (!this.type || i.tx.type === this.type) &&
      (!this.category || i.tx.category === this.category) &&
      i.t >= lo && i.t <= hi &&
      (min == null || i.tx.amount >= min) &&
      (max == null || i.tx.amount <= max));

    const s = this.sort;
    out.sort((a, b) =>
      s === 'new' ? b.t - a.t : s === 'old' ? a.t - b.t
      : s === 'high' ? b.tx.amount - a.tx.amount : s === 'low' ? a.tx.amount - b.tx.amount
      : a.tx.category.localeCompare(b.tx.category) || b.t - a.t);

    let inc = 0, exp = 0;
    for (const i of out) i.tx.type === 'income' ? (inc += i.tx.amount) : (exp += i.tx.amount);
    this.income = inc;
    this.expense = exp;
    this.results = out;
    this.limit = 50;
    this.shown = out.slice(0, this.limit);
  }

  private range(): [number, number] {
    const n = new Date(), today = day0(n);
    switch (this.date) {
      case 'today': return [today, today + DAY - 1];
      case '7d': return [today - 6 * DAY, today + DAY - 1];
      case 'month': return [new Date(n.getFullYear(), n.getMonth(), 1).getTime(), Infinity];
      case 'year': return [new Date(n.getFullYear(), 0, 1).getTime(), Infinity];
      case 'custom': {
        let a = parse(this.from) ?? 0, b = parse(this.to);
        b = b == null ? Infinity : b + DAY - 1;
        return a > b ? [b - DAY + 1, a + DAY - 1] : [a, b];     // tolerate inverted input
      }
      default: return [0, Infinity];
    }
  }

  private iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
