import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog/transaction-detail-dialog.component';
import { InrPipe } from '../shared/inr.pipe';
import { SwipeRowDirective } from '../shared/swipe-row.directive';

type Filter = 'all' | 'expense' | 'income';
interface Group { label: string; spent: number; items: Transaction[] }

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, MatIconModule, InrPipe, SwipeRowDirective],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css'],
})
export class TransactionsComponent implements OnInit {
  filters: { v: Filter; l: string }[] = [
    { v: 'all', l: 'All' },
    { v: 'expense', l: 'Expenses' },
    { v: 'income', l: 'Income' },
  ];
  filter: Filter = 'all';
  groups: Group[] = [];
  loaded = false;
  hasAny = false;

  private all: Transaction[] = [];
  private view: Transaction[] = [];
  private colors = new Map<string, string>();
  private limit = 30;
  private readonly step = 30;

  constructor(private db: DexieService, private dialog: MatDialog, private router: Router, private snack: MatSnackBar) {}

  async ngOnInit() {
    await this.load();
    this.loaded = true;
  }

  private async load() {
    const [txs, cats] = await Promise.all([this.db.getTransactionsNewestFirst(), this.db.getAllCategories()]);
    this.all = txs;
    this.hasAny = txs.length > 0;
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.apply();
  }

  get hasMore() {
    return this.view.length > this.limit;
  }

  setFilter(f: Filter) {
    this.filter = f;
    this.limit = this.step;
    this.apply();
  }

  more() {
    this.limit += this.step;
    this.build();
  }

  color(name: string) {
    return this.colors.get(name) || '#d4d4d4';
  }

  open(tx: Transaction, row?: SwipeRowDirective, edit = false) {
    if (row?.swiped) return;
    this.dialog
      .open(TransactionDetailDialogComponent, { width: '500px', maxWidth: '95vw', data: { transaction: tx, edit } })
      .afterClosed()
      .subscribe(r => (r?.updated || r?.deleted || r?.duplicated) && this.load());
  }

  async remove(tx: Transaction) {
    if (!tx.id) return;
    const backup = { ...tx };
    try {
      await this.db.deleteTransaction(tx.id);
    } catch {
      this.snack.open('Delete failed', 'OK', { duration: 3000 });
      return;
    }
    await this.load();
    this.snack.open('Deleted', 'Undo', { duration: 5000 }).onAction().subscribe(async () => {
      await this.db.restoreTransaction(backup);
      this.load();
    });
  }

  async dup(tx: Transaction) {
    await this.db.duplicateTransaction(tx);
    await this.load();
    this.snack.open('Duplicated to today', undefined, { duration: 1500 });
  }

  search() {
    this.router.navigate(['/search']);
  }

  private apply() {
    this.view = this.filter === 'all' ? this.all : this.all.filter(t => t.type === this.filter);
    this.build();
  }

  private build() {
    const today = this.key(new Date());
    const yest = this.key(new Date(Date.now() - 864e5));
    const map = new Map<string, Group>();
    for (const t of this.view.slice(0, this.limit)) {
      const d = new Date(t.date);
      const k = this.key(d);
      let g = map.get(k);
      if (!g) {
        const label = k === today ? 'Today' : k === yest ? 'Yesterday'
          : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
        g = { label, spent: 0, items: [] };
        map.set(k, g);
      }
      g.items.push(t);
      if (t.type === 'expense') g.spent += t.amount;
    }
    this.groups = [...map.values()];
  }

  private key(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
}
