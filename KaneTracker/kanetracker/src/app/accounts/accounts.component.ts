import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEFAULT_ACCOUNTS, DexieService } from '../services/dexie.service';
import { InrPipe } from '../shared/inr.pipe';
import { Transfer, accountFlows, balances } from '../shared/accounts';
import { toInput } from '../shared/utils';
import { CardInfo, nextDue } from '../shared/cards';

interface Row { name: string; bal: number }

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Accounts</h1><span class="sp"></span>
      </header>

      <section class="hero">
        <p class="label">Total across accounts</p>
        <p class="big" [class.neg]="total < 0">{{ total < 0 ? '−' : '' }}{{ abs(total) | inr }}</p>
        <p class="muted" *ngIf="noAcc">{{ noAcc }} entr{{ noAcc === 1 ? 'y has' : 'ies have' }} no account and {{ noAcc === 1 ? 'is' : 'are' }} not counted.</p>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Balances</h2></div>
        <div class="a" *ngFor="let r of rows">
          <button class="ah" (click)="edit = edit === r.name ? '' : r.name; cur = null; dueIn = dueOf(r.name)">
            <span class="nm">{{ r.name }}<small class="muted" *ngIf="dueText(r.name)"> · {{ dueText(r.name) }}</small></span><b [class.neg]="r.bal < 0">{{ r.bal < 0 ? '−' : '' }}{{ abs(r.bal) | inr }}</b>
          </button>
          <div class="ad" *ngIf="edit === r.name">
            <label class="label">Set current balance</label>
            <div class="row2"><input type="number" inputmode="decimal" step="any" [(ngModel)]="cur" [placeholder]="r.bal + ''" />
              <button class="btn" (click)="setBal(r)" [disabled]="cur === null">Save</button></div>
            <p class="muted">Enter what the account holds right now. Entries and transfers adjust it from here.</p>
            <label class="label">Credit card? Payment due day of month</label>
            <div class="row2"><input type="number" inputmode="numeric" min="1" max="31" step="1" [(ngModel)]="dueIn" placeholder="e.g. 20 (empty = not a card)" />
              <button class="btn" (click)="saveDue(r)">Save</button></div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Transfer</h2></div>
        <p class="muted" *ngIf="names.length < 2">Add at least two accounts in Settings to move money between them.</p>
        <ng-container *ngIf="names.length >= 2">
          <div class="row2">
            <select [(ngModel)]="from" aria-label="From"><option *ngFor="let n of names" [value]="n">{{ n }}</option></select>
            <mat-icon>arrow_forward</mat-icon>
            <select [(ngModel)]="to" aria-label="To"><option *ngFor="let n of names" [value]="n">{{ n }}</option></select>
          </div>
          <div class="row2">
            <input type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="amt" placeholder="Amount" aria-label="Transfer amount" />
            <input type="date" [(ngModel)]="date" aria-label="Date" />
          </div>
          <p class="err" *ngIf="err">{{ err }}</p>
          <button class="btn full" (click)="transfer()">Move money</button>
          <p class="muted">Transfers are not income or spending, so budgets and totals stay unchanged. Pay a credit-card bill by moving money from bank to card.</p>
        </ng-container>

        <div class="t" *ngFor="let t of transfers.slice(0, 10)">
          <span>{{ t.date | date:'d MMM' }} · {{ t.from }} → {{ t.to }}</span>
          <b>{{ t.amount | inr }}</b>
          <button class="x" (click)="del(t.id)" aria-label="Delete transfer"><mat-icon>close</mat-icon></button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .a { border-bottom: 1px solid var(--k-line); }
    .ah { display: flex; justify-content: space-between; width: 100%; padding: 14px 0; border: 0; background: none; color: inherit; font: inherit; }
    .ah b { font-weight: 500; font-variant-numeric: tabular-nums; } .neg { color: var(--k-neg, #dc2626); }
    .ad { padding-bottom: 12px; } .ad .label { display: block; margin-top: 12px; }
    .row2 { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
    .row2 input, .row2 select { flex: 1; min-width: 0; min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; box-sizing: border-box; }
    .row2 .btn { min-height: 48px; padding: 0 16px; } .full { width: 100%; }
    .err { color: #dc2626; font-size: 14px; }
    .t { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 14px; } .t span { flex: 1; min-width: 0; }
    .x { border: 0; background: none; color: var(--k-muted); display: grid; place-items: center; }
    .x mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class AccountsComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  loaded = false;
  rows: Row[] = [];
  names: string[] = [];
  total = 0;
  noAcc = 0;
  edit = '';
  cur: number | null = null;
  dueIn: number | null = null;
  cards: CardInfo[] = [];
  transfers: Transfer[] = [];
  from = '';
  to = '';
  amt: number | null = null;
  date = toInput(new Date());
  err = '';
  abs = Math.abs;

  private opening: Record<string, number> = {};
  private flows: Record<string, number> = {};

  async ngOnInit() { await this.load(); this.loaded = true; }

  private async load() {
    const [list, opening, transfers, txs] = await Promise.all([
      this.db.getSetting<string[]>('accounts', [...DEFAULT_ACCOUNTS]), this.db.getSetting<Record<string, number>>('accountOpening', {}),
      this.db.getSetting<Transfer[]>('transfers', []), this.db.getAllTransactions(),
    ]);
    this.opening = opening;
    this.cards = await this.db.getSetting<CardInfo[]>('cards', []);
    this.transfers = [...transfers].sort((a, b) => b.date.localeCompare(a.date));
    this.flows = accountFlows(txs, transfers);
    const set = new Set<string>(list);
    for (const k of [...Object.keys(opening), ...Object.keys(this.flows)]) set.add(k);
    this.names = [...set];
    const b = balances(this.names, opening, this.flows);
    this.rows = this.names.map(name => ({ name, bal: b[name] }));
    this.total = Math.round(this.rows.reduce((s, r) => s + r.bal, 0) * 100) / 100;
    this.noAcc = txs.filter(t => !t.account).length;
    if (!this.from) { this.from = this.names[0] || ''; this.to = this.names[1] || ''; }
  }

  dueOf(name: string): number | null { return this.cards.find(c => c.account === name)?.dueDay ?? null; }

  dueText(name: string): string {
    const d = this.dueOf(name);
    if (!d) return '';
    const n = nextDue(d, new Date());
    return `due ${n.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${n.days <= 7 ? ' (' + (n.days === 0 ? 'today' : 'in ' + n.days + 'd') + ')' : ''}`;
  }

  async saveDue(r: Row) {
    const v = this.dueIn === null || this.dueIn === undefined || (this.dueIn as any) === '' ? null : Math.round(Number(this.dueIn));
    if (v !== null && !(v >= 1 && v <= 31)) { this.snack.open('Day must be 1 to 31', 'OK', { duration: 2500 }); return; }
    const rest = this.cards.filter(c => c.account !== r.name);
    await this.db.setSetting('cards', v === null ? rest : [...rest, { account: r.name, dueDay: v }]);
    this.edit = '';
    await this.load();
  }

  async setBal(r: Row) {
    if (this.cur === null || !isFinite(Number(this.cur))) return;
    // opening = wanted balance − what entries/transfers already moved
    const o = Math.round((Number(this.cur) - (this.flows[r.name] || 0)) * 100) / 100;
    await this.db.setSetting('accountOpening', { ...this.opening, [r.name]: o });
    this.edit = ''; this.cur = null;
    await this.load();
  }

  async transfer() {
    this.err = '';
    const a = Number(this.amt);
    if (!this.from || !this.to || this.from === this.to) { this.err = 'Pick two different accounts.'; return; }
    if (!(a > 0) || !isFinite(a)) { this.err = 'Enter an amount.'; return; }
    if (!this.date) { this.err = 'Pick a date.'; return; }
    const t: Transfer = { id: Date.now().toString(36), from: this.from, to: this.to, amount: Math.round(a * 100) / 100, date: new Date(this.date + 'T12:00:00').toISOString() };
    await this.db.setSetting('transfers', [...this.transfers, t]);
    this.amt = null;
    await this.load();
    this.snack.open('Moved', undefined, { duration: 1500 });
  }

  async del(id: string) {
    await this.db.setSetting('transfers', this.transfers.filter(t => t.id !== id));
    await this.load();
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }
}
