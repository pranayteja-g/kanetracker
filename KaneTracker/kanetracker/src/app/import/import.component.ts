import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';
import { Transaction } from '../models/transaction.interface';
import { buildCategorizer } from '../shared/categorize';
import { ParsedRow, parseSms, parseStatementCsv } from '../shared/import-parse';
import { InrPipe } from '../shared/inr.pipe';

interface Row extends ParsedRow { on: boolean; dup: boolean; cat: string }

const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16'];

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatIconModule, InrPipe],
  template: `
    <div class="page">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Import</h1><span class="sp"></span>
      </header>

      <div class="chips">
        <button class="chip" [class.on]="mode === 'csv'" (click)="setMode('csv')">Statement CSV</button>
        <button class="chip" [class.on]="mode === 'sms'" (click)="setMode('sms')">Bank SMS</button>
      </div>

      <ng-container *ngIf="!rows.length">
        <label class="btn ghost pick" *ngIf="mode === 'csv'"><mat-icon>upload_file</mat-icon>Choose CSV file
          <input type="file" accept=".csv,text/csv,text/plain" hidden (change)="onFile($event)" /></label>
        <p class="muted" *ngIf="mode === 'csv'">Needs a Date column and Amount, or Debit/Credit columns. Works with this app's own CSV export.</p>
        <p class="muted" *ngIf="mode === 'sms'">Paste one or many bank SMS (blank line between messages).</p>
        <textarea [(ngModel)]="text" rows="8" [placeholder]="mode === 'sms' ? 'Rs.450.00 debited from A/c XX1234 on 12-Jan-25 to SWIGGY UPI...' : 'Or paste CSV text here'"></textarea>
        <button class="btn go" (click)="parse()" [disabled]="!text.trim()">Preview</button>
        <p class="err" *ngIf="err">{{ err }}</p>
      </ng-container>

      <ng-container *ngIf="rows.length">
        <p class="muted">{{ selected }} of {{ rows.length }} selected<span *ngIf="dups"> · {{ dups }} look like duplicates (unchecked)</span></p>
        <div class="r" *ngFor="let r of rows" [class.off]="!r.on">
          <input type="checkbox" [(ngModel)]="r.on" aria-label="Include" />
          <div class="m">
            <b>{{ r.desc || '(no description)' }}</b>
            <span>{{ r.date | date:'d MMM y' }}<span *ngIf="r.dup" class="dup"> · duplicate?</span></span>
            <select [(ngModel)]="r.cat" [attr.aria-label]="'Category for ' + r.desc">
              <option value="">Pick category</option>
              <option *ngFor="let c of catsFor(r.type)" [value]="c.name">{{ c.name }}</option>
              <option *ngIf="r.cat && !hasCat(r)" [value]="r.cat">{{ r.cat }} (new)</option>
            </select>
          </div>
          <span class="a" [class.income]="r.type === 'income'">{{ r.type === 'income' ? '+' : '−' }}{{ r.amount | inr }}</span>
        </div>
        <div class="bar">
          <button class="btn ghost" (click)="rows = []">Back</button>
          <button class="btn" (click)="commit()" [disabled]="!ready || busy">Import {{ selected }}</button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .pick { margin-top: 16px; width: 100%; cursor: pointer; }
    textarea { width: 100%; box-sizing: border-box; margin-top: 12px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 14px; }
    .go { width: 100%; margin-top: 12px; }
    .err { color: #dc2626; margin-top: 8px; font-size: 14px; }
    .r { display: flex; gap: 10px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--k-line); }
    .r.off { opacity: .45; }
    .r input[type=checkbox] { width: 20px; height: 20px; margin-top: 2px; }
    .m { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .m b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m > span { font-size: 13px; color: var(--k-muted); }
    .dup { color: #b45309; }
    select { min-height: 36px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 14px; }
    .a { font-weight: 500; font-variant-numeric: tabular-nums; }
    .a.income { color: var(--k-income); }
    .bar { position: sticky; bottom: calc(80px + env(safe-area-inset-bottom)); display: flex; gap: 8px; padding: 12px 0; background: linear-gradient(transparent, var(--k-bg) 30%); }
    .bar .btn:last-child { flex: 1; }
  `],
})
export class ImportComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  mode: 'csv' | 'sms' = 'csv';
  text = '';
  err = '';
  rows: Row[] = [];
  busy = false;
  private cats: Category[] = [];
  private existing = new Set<string>();
  private guess!: (d: string, t: 'income' | 'expense') => string;

  get selected() { return this.rows.filter(r => r.on).length; }
  get dups() { return this.rows.filter(r => r.dup).length; }
  get ready() { return this.selected > 0 && this.rows.filter(r => r.on).every(r => r.cat); }

  async ngOnInit() {
    const [cats, txs] = await Promise.all([this.db.getAllCategories(), this.db.getAllTransactions()]);
    this.cats = cats;
    this.guess = buildCategorizer(txs, cats);
    txs.forEach(t => this.existing.add(this.key(new Date(t.date), t.amount, t.type)));
  }

  private key(d: Date, a: number, t: string) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${a}|${t}`; }
  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }
  setMode(m: 'csv' | 'sms') { this.mode = m; this.text = ''; this.err = ''; }
  catsFor(t: 'income' | 'expense') { return this.cats.filter(c => c.type === t); }
  hasCat(r: Row) { return this.cats.some(c => c.type === r.type && c.name === r.cat); }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > 5_000_000) { this.err = 'File too big (max 5 MB)'; return; }
    this.text = await f.text();
    this.parse();
  }

  parse() {
    this.err = '';
    const parsed = this.mode === 'csv' ? parseStatementCsv(this.text) : parseSms(this.text);
    if (!parsed.length) {
      this.err = this.mode === 'csv' ? 'No rows found. Need a header with Date + Amount (or Debit/Credit).' : 'No amounts found in text.';
      return;
    }
    const seen = new Set<string>();
    this.rows = parsed.slice(0, 2000).map(p => {
      const k = this.key(p.date, p.amount, p.type);
      const dup = this.existing.has(k);
      seen.add(k);
      return { ...p, dup, on: !dup, cat: p.category || this.guess(p.desc, p.type) };
    });
  }

  async commit() {
    this.busy = true;
    try {
      const chosen = this.rows.filter(r => r.on);
      // create any categories named in the file that don't exist yet
      const need = new Map<string, 'income' | 'expense'>();
      chosen.forEach(r => { if (!this.cats.some(c => c.type === r.type && c.name.toLowerCase() === r.cat.toLowerCase())) need.set(`${r.type}|${r.cat}`, r.type); });
      let i = 0;
      for (const [k, type] of need) {
        await this.db.addCategory({ name: k.split('|')[1], type, color: PALETTE[i++ % PALETTE.length] });
      }
      const fresh = await this.db.getAllCategories();
      const txs: Transaction[] = chosen.map(r => {
        const name = fresh.find(c => c.type === r.type && c.name.toLowerCase() === r.cat.toLowerCase())?.name || r.cat;
        const t: Transaction = { type: r.type, amount: r.amount, category: name, date: r.date.toISOString(), description: r.desc };
        if (r.account) t.account = r.account;
        if (r.tags?.length) t.tags = r.tags;
        return t;
      });
      await this.db.transactions.bulkAdd(txs);
      this.snack.open(`Imported ${txs.length}`, 'OK', { duration: 3000 });
      this.router.navigate(['/transactions']);
    } catch (e) {
      console.error(e);
      this.snack.open('Import failed', 'OK', { duration: 4000 });
      this.busy = false;
    }
  }
}
