import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { InrPipe } from '../shared/inr.pipe';
import { ME, Settlement, computeBalances, totals } from '../shared/splits';
import { toInput } from '../shared/utils';

interface Row { name: string; bal: number }

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Splits</h1><span class="sp"></span>
      </header>

      <section class="hero" *ngIf="rows.length">
        <div class="split">
          <div><span class="label">They owe you</span><b class="inc">{{ tot.owedToMe | inr }}</b></div>
          <div><span class="label">You owe</span><b>{{ tot.iOwe | inr }}</b></div>
        </div>
      </section>

      <section class="sec">
        <div class="row-h"><h2>People</h2></div>
        <div class="add">
          <input type="text" maxlength="30" placeholder="Add a person" [(ngModel)]="newName" (keyup.enter)="addPerson()" />
          <button class="btn" (click)="addPerson()" [disabled]="!newName.trim()">Add</button>
        </div>
        <p class="muted" *ngIf="!rows.length">Add friends here, then pick "Split" when you add an expense. Balances show up here.</p>

        <div class="p" *ngFor="let r of rows">
          <button class="ph" (click)="open = open === r.name ? '' : r.name">
            <span class="av">{{ r.name[0].toUpperCase() }}</span>
            <span class="nm">{{ r.name }}</span>
            <b [class.pos]="r.bal > 0" [class.neg]="r.bal < 0">{{ r.bal > 0 ? 'owes you ' + (r.bal | inr) : r.bal < 0 ? 'you owe ' + (-r.bal | inr) : 'settled' }}</b>
          </button>
          <div class="pd" *ngIf="open === r.name">
            <div class="settle" *ngIf="r.bal !== 0">
              <input type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="payAmt" [placeholder]="abs(r.bal) + ''" aria-label="Amount" />
              <button class="btn" (click)="settle(r)">{{ r.bal > 0 ? 'Got paid' : 'I paid' }}</button>
            </div>
            <p class="muted" *ngIf="r.bal !== 0">Leave empty to settle the full {{ abs(r.bal) | inr }}.</p>
            <p class="label" *ngIf="hist(r.name).length">History</p>
            <div class="h" *ngFor="let h of hist(r.name)">
              <span>{{ h.date | date:'d MMM' }} · {{ h.text }}</span>
              <button *ngIf="h.sid" class="x" (click)="undo(h.sid)" aria-label="Delete settlement"><mat-icon>close</mat-icon></button>
            </div>
            <button class="link del" (click)="remove(r)">Remove person</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .split { display: flex; gap: 32px; } .split div { display: flex; flex-direction: column; gap: 2px; }
    .split b { font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; }
    .add { display: flex; gap: 8px; margin-bottom: 12px; }
    .add input, .settle input { flex: 1; min-width: 0; min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; box-sizing: border-box; }
    .p { border-bottom: 1px solid var(--k-line); }
    .ph { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; }
    .av { width: 36px; height: 36px; border-radius: 50%; background: var(--k-line); display: grid; place-items: center; font-weight: 600; flex: none; }
    .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ph b { font-weight: 500; font-size: 14px; color: var(--k-muted); } .ph b.pos { color: #16a34a; } .ph b.neg { color: var(--k-neg, #dc2626); }
    .pd { padding: 0 0 12px 48px; }
    .settle { display: flex; gap: 8px; } .settle .btn { min-height: 48px; padding: 0 16px; }
    .h { display: flex; justify-content: space-between; align-items: center; font-size: 14px; padding: 4px 0; gap: 8px; }
    .x { border: 0; background: none; color: var(--k-muted); display: grid; place-items: center; }
    .x mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .del { border: 0; background: none; color: var(--k-neg, #dc2626); font: inherit; padding: 8px 0 0; }
  `],
})
export class PeopleComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  loaded = false;
  rows: Row[] = [];
  tot = { owedToMe: 0, iOwe: 0 };
  open = '';
  newName = '';
  payAmt: number | null = null;
  private people: string[] = [];
  private txs: Transaction[] = [];
  private sets: Settlement[] = [];

  abs = Math.abs;

  async ngOnInit() { await this.load(); this.loaded = true; }

  private async load() {
    const [people, sets, txs] = await Promise.all([
      this.db.getSetting<string[]>('people', []), this.db.getSetting<Settlement[]>('settlements', []), this.db.getAllTransactions(),
    ]);
    this.txs = txs.filter(t => t.split);
    this.sets = sets;
    // anyone in a split stays listed even if removed from the list
    const names = new Set(people);
    for (const t of this.txs) { names.add(t.split!.paidBy); t.split!.with.forEach(w => names.add(w)); }
    names.delete(ME);
    this.people = [...names].sort((a, b) => a.localeCompare(b));
    const b = computeBalances(txs, sets);
    this.rows = this.people.map(name => ({ name, bal: b[name] || 0 }));
    this.tot = totals(b);
  }

  hist(name: string) {
    const out: { date: string; text: string; sid?: string }[] = [];
    for (const t of this.txs) {
      const s = t.split!;
      if (s.paidBy === name) out.push({ date: t.date, text: `${t.category}: they paid, your share ${this.fmt(t.amount)}` });
      else if (s.paidBy === ME && s.with.includes(name)) out.push({ date: t.date, text: `${t.category}: you paid, their share ${this.fmt((s.total - t.amount) / s.with.length)}` });
    }
    for (const st of this.sets) if (st.person === name) out.push({ date: st.date, sid: st.id, text: st.amount > 0 ? `Paid you ${this.fmt(st.amount)}` : `You paid ${this.fmt(-st.amount)}` });
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }

  private fmt(n: number) { return new InrPipe().transform(Math.round(n * 100) / 100); }

  async addPerson() {
    const n = this.newName.trim().slice(0, 30);
    if (!n) return;
    if (n.toLowerCase() === ME || this.people.some(p => p.toLowerCase() === n.toLowerCase())) { this.snack.open('Already added', undefined, { duration: 2000 }); return; }
    await this.db.setSetting('people', [...this.people, n]);
    this.newName = '';
    await this.load();
  }

  async settle(r: Row) {
    const amt = this.payAmt != null && Number(this.payAmt) > 0 ? Number(this.payAmt) : Math.abs(r.bal);
    const signed = r.bal > 0 ? amt : -amt; // they pay me : I pay them
    await this.db.setSetting('settlements', [...this.sets, { id: Date.now().toString(36), person: r.name, amount: Math.round(signed * 100) / 100, date: new Date().toISOString() }]);
    this.payAmt = null;
    await this.load();
    this.snack.open('Settled', undefined, { duration: 1500 });
  }

  async undo(id: string) {
    await this.db.setSetting('settlements', this.sets.filter(s => s.id !== id));
    await this.load();
  }

  async remove(r: Row) {
    const used = this.txs.some(t => t.split!.paidBy === r.name || t.split!.with.includes(r.name));
    if (used || r.bal !== 0) { this.snack.open('Has split entries. Settle first; entries stay in History.', 'OK', { duration: 4000 }); if (r.bal === 0) { /* history-only person */ } return; }
    const before = this.people;
    await this.db.setSetting('people', before.filter(p => p !== r.name));
    this.open = '';
    await this.load();
    this.snack.open(`${r.name} removed`, 'Undo', { duration: 5000 }).onAction().subscribe(async () => {
      await this.db.setSetting('people', before);
      await this.load();
    });
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }
}
