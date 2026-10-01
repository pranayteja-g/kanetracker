import { Component, Inject, OnInit } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEFAULT_ACCOUNTS, DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import { InrPipe } from '../shared/inr.pipe';
import { compressImage, parseTags, round2, symbol } from '../shared/utils';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-transaction-detail-dialog',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, MatDialogModule, MatIconModule, InrPipe],
  template: `
    <div class="dlg">
      <header>
        <h2 mat-dialog-title>{{ edit ? 'Edit' : 'Transaction' }}</h2>
        <button class="icon-btn" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
      </header>

      <ng-container *ngIf="!edit">
        <p class="amt" [ngClass]="tx.type">{{ tx.type === 'income' ? '+' : '−' }}{{ tx.amount | inr }}</p>
        <dl>
          <dt>Category</dt><dd>{{ tx.category }}</dd>
          <dt>Date</dt><dd>{{ tx.date | date:'EEE, d MMM y' }}</dd>
          <dt>Note</dt><dd>{{ tx.description || '—' }}</dd>
          <ng-container *ngIf="tx.currency"><dt>Original</dt><dd>{{ sym(tx.currency) }}{{ tx.origAmount }} &#64; {{ tx.rate }}</dd></ng-container>
          <ng-container *ngIf="tx.account"><dt>Account</dt><dd>{{ tx.account }}</dd></ng-container>
          <ng-container *ngIf="tx.tags?.length"><dt>Tags</dt><dd>#{{ tx.tags!.join(' #') }}</dd></ng-container>
          <ng-container *ngIf="tx.recurringId"><dt>Repeats</dt><dd>Recurring entry</dd></ng-container>
        </dl>
        <img class="rcpt" *ngIf="tx.receipt" [src]="tx.receipt" alt="Receipt" (click)="zoom = !zoom" [class.zoom]="zoom" />
        <div class="actions">
          <button class="btn ghost" (click)="startEdit()"><mat-icon>edit</mat-icon>Edit</button>
          <button class="btn ghost" (click)="dup()"><mat-icon>content_copy</mat-icon>Copy</button>
          <button class="btn ghost del" (click)="remove()"><mat-icon>delete_outline</mat-icon>Delete</button>
        </div>
      </ng-container>

      <ng-container *ngIf="edit">
        <div class="seg">
          <button type="button" [class.on]="f.type === 'expense'" (click)="setType('expense')">Expense</button>
          <button type="button" [class.on]="f.type === 'income'" (click)="setType('income')">Income</button>
        </div>
        <label><span class="label">Amount {{ tx.currency ? sym(tx.currency) : '₹' }}</span><input type="number" inputmode="decimal" min="0.01" step="0.01" [(ngModel)]="f.amount" /></label>
        <label><span class="label">Category</span>
          <select [(ngModel)]="f.category">
            <option value="" disabled>Select</option>
            <option *ngFor="let c of cats" [value]="c.name">{{ c.name }}</option>
          </select></label>
        <label><span class="label">Date</span><input type="date" [(ngModel)]="f.date" /></label>
        <label><span class="label">Note</span><input type="text" maxlength="200" [(ngModel)]="f.description" /></label>
        <label><span class="label">Account</span>
          <select [(ngModel)]="f.account">
            <option value="">None</option>
            <option *ngFor="let a of accounts" [value]="a">{{ a }}</option>
          </select></label>
        <label><span class="label">Tags</span><input type="text" [(ngModel)]="f.tags" placeholder="trip, work" autocapitalize="none" /></label>
        <div class="rfield">
          <img *ngIf="f.receipt" [src]="f.receipt" alt="Receipt" />
          <label class="btn ghost file"><mat-icon>photo_camera</mat-icon>{{ f.receipt ? 'Change receipt' : 'Attach receipt' }}<input type="file" accept="image/*" hidden (change)="onFile($event)" /></label>
          <button class="btn ghost" *ngIf="f.receipt" (click)="f.receipt = ''"><mat-icon>close</mat-icon></button>
        </div>
        <div class="actions">
          <button class="btn ghost" (click)="edit = false">Cancel</button>
          <button class="btn" (click)="save()" [disabled]="!valid || saving">Save</button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dlg { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    header { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; padding: 0; font-size: 18px; font-weight: 600; }
    h2::before { display: none; }
    .amt { margin: 0; font-size: 36px; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
    .amt.income { color: var(--k-income); }
    dl { display: grid; grid-template-columns: 80px 1fr; gap: 10px 8px; margin: 0; }
    dt { color: var(--k-muted); font-size: 13px; padding-top: 2px; }
    dd { margin: 0; word-break: break-word; }
    .actions { display: flex; gap: 8px; }
    .actions .btn { flex: 1; }
    .del { color: var(--k-neg); }
    .rcpt { width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; cursor: zoom-in; }
    .rcpt.zoom { max-height: none; object-fit: contain; cursor: zoom-out; }
    .rfield { display: flex; gap: 8px; align-items: center; }
    .rfield img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
    .file { flex: 1; cursor: pointer; flex-direction: row; }
    label { display: flex; flex-direction: column; gap: 4px; }
    input, select { min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; }
    .seg { display: flex; padding: 3px; border-radius: 999px; background: var(--k-line); }
    .seg button { flex: 1; border: 0; background: none; padding: 8px; border-radius: 999px; font-size: 14px; color: var(--k-muted); }
    .seg button.on { background: var(--k-surface); color: var(--k-ink); font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  `],
})
export class TransactionDetailDialogComponent implements OnInit {
  tx: Transaction;
  edit = false;
  saving = false;
  cats: Category[] = [];
  f = { type: 'expense' as 'income' | 'expense', amount: null as number | null, category: '', date: '', description: '', account: '', tags: '', receipt: '' };
  accounts: string[] = [];
  zoom = false;
  sym = symbol;
  private all: Category[] = [];

  constructor(
    private ref: MatDialogRef<TransactionDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: { transaction: Transaction; edit?: boolean },
    private db: DexieService,
    private snack: MatSnackBar
  ) {
    this.tx = data.transaction;
  }

  async ngOnInit() {
    this.all = await this.db.getAllCategories();
    this.accounts = await this.db.getSetting('accounts', DEFAULT_ACCOUNTS);
    if (this.data.edit) this.startEdit();
  }

  get valid() {
    return !!this.f.amount && this.f.amount > 0 && !!this.f.category && !!this.f.date;
  }

  startEdit() {
    const t = this.tx;
    this.f = {
      type: t.type, amount: t.currency ? t.origAmount ?? t.amount : t.amount, category: t.category,
      date: iso(new Date(t.date)), description: t.description || '', account: t.account || '',
      tags: (t.tags || []).join(', '), receipt: t.receipt || '',
    };
    this.cats = this.all.filter(c => c.type === t.type);
    this.edit = true;
  }

  setType(t: 'income' | 'expense') {
    if (t === this.f.type) return;
    this.f.type = t;
    this.f.category = '';
    this.cats = this.all.filter(c => c.type === t);
  }

  async save() {
    if (!this.valid || !this.tx.id) return;
    this.saving = true;
    try {
      const [y, m, d] = this.f.date.split('-').map(Number);
      const entered = Number(this.f.amount);
      const tags = parseTags(this.f.tags);
      await this.db.transactions.where(':id').equals(this.tx.id).modify((row: Transaction) => {
        row.type = this.f.type;
        row.category = this.f.category;
        row.date = new Date(y, m - 1, d).toISOString();
        row.description = this.f.description.trim();
        if (row.currency && row.rate) { row.origAmount = entered; row.amount = round2(entered * row.rate); }
        else row.amount = entered;
        this.f.account ? (row.account = this.f.account) : delete row.account;
        tags.length ? (row.tags = tags) : delete row.tags;
        this.f.receipt ? (row.receipt = this.f.receipt) : delete row.receipt;
      });
      this.snack.open('Updated', undefined, { duration: 1500 });
      this.ref.close({ updated: true });
    } catch {
      this.snack.open('Update failed', 'OK', { duration: 3000 });
      this.saving = false;
    }
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try { this.f.receipt = await compressImage(file); } catch { this.snack.open('Could not read image', 'OK', { duration: 3000 }); }
  }

  async dup() {
    try {
      await this.db.duplicateTransaction(this.tx);
      this.snack.open('Duplicated to today', undefined, { duration: 1500 });
      this.ref.close({ duplicated: true });
    } catch {
      this.snack.open('Copy failed', 'OK', { duration: 3000 });
    }
  }

  async remove() {
    if (!this.tx.id || !confirm('Delete this transaction?')) return;
    try {
      await this.db.deleteTransaction(this.tx.id);
      this.snack.open('Deleted', undefined, { duration: 1500 });
      this.ref.close({ deleted: true });
    } catch {
      this.snack.open('Delete failed', 'OK', { duration: 3000 });
    }
  }
}
