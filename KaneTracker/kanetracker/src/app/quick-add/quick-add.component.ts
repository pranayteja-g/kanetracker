import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';
import { Transaction } from '../models/transaction.interface';
import { Trip } from '../models/trip.interface';
import { buildClassifier } from '../shared/categorize';
import { Quick, parseQuick } from '../shared/quickadd';
import { fmtMoney, getBase } from '../shared/currency';
import { tripsOnDate } from '../shared/trips';

@Component({
  selector: 'app-quick-add',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MatIconModule],
  template: `
    <section class="qa">
      <div class="in">
        <mat-icon>bolt</mat-icon>
        <input type="text" [(ngModel)]="text" (ngModelChange)="parse()" (keydown.enter)="add()" placeholder="Quick add: 250 swiggy" maxlength="120" aria-label="Quick add" autocomplete="off" enterkeyhint="done" />
      </div>
      <div class="pv" *ngIf="q">
        <span class="sum"><b>{{ q.type === 'income' ? '+' : '' }}{{ money(q.amount) }}</b> · {{ q.note || 'no note' }}<ng-container *ngIf="trip && q.type === 'expense'"> · <mat-icon class="tic">luggage</mat-icon>{{ trip.name }}</ng-container></span>
        <select [(ngModel)]="cat" aria-label="Category"><option *ngFor="let c of choices" [value]="c.name">{{ c.name }}</option></select>
        <div class="acts">
          <button class="btn ghost" (click)="edit()">Edit</button>
          <button class="btn" (click)="add()" [disabled]="busy || !cat">{{ review ? 'Review' : 'Add' }}</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .qa { margin: 12px 0 4px; }
    .in { display: flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 14px; background: var(--k-surface); }
    .in mat-icon { color: var(--k-muted); flex: none; }
    .in input { flex: 1; min-width: 0; min-height: 48px; border: 0; background: none; color: var(--k-ink); font: inherit; font-size: 16px; outline: none; }
    .pv { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
    .sum { font-size: 14px; } .sum b { font-weight: 600; } .tic { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .pv select { min-height: 44px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; }
    .acts { display: flex; gap: 8px; } .acts .btn { flex: 1; min-height: 44px; }
  `],
})
export class QuickAddComponent implements OnInit, OnChanges {
  private db = inject(DexieService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  @Input() txs: Transaction[] = [];
  @Input() cats: Category[] = [];
  @Output() added = new EventEmitter<void>();

  text = '';
  q: Quick | null = null;
  cat = '';
  choices: Category[] = [];
  trip?: Trip;
  busy = false;
  private clf?: ReturnType<typeof buildClassifier>;

  /** A foreign-currency trip is active: typed amount could be either currency, so let the form decide. */
  get review() { return !!this.trip && this.trip.currency !== getBase() && this.q?.type === 'expense'; }

  async ngOnInit() { this.trip = tripsOnDate(await this.db.getTrips(), new Date())[0]; }
  ngOnChanges() { if (this.cats.length) this.clf = buildClassifier(this.txs, this.cats); this.parse(); }

  money(n: number) { return fmtMoney(n); }

  parse() {
    this.q = parseQuick(this.text);
    if (!this.q) return;
    this.choices = this.cats.filter(c => c.type === this.q!.type);
    const s = this.clf?.suggest(this.q.note, this.q.type);
    this.cat = s && this.choices.some(c => c.name === s.category) ? s.category : this.choices[0]?.name || '';
  }

  edit() {
    if (!this.q) return;
    this.router.navigate(['/transaction-form'], { queryParams: { amount: this.q.amount, note: this.q.note, category: this.cat, type: this.q.type } });
  }

  async add() {
    if (!this.q || !this.cat || this.busy) return;
    if (this.review) { this.edit(); return; }
    this.busy = true;
    try {
      const tx: Transaction = { type: this.q.type, amount: this.q.amount, category: this.cat, date: new Date().toISOString(), description: this.q.note };
      if (this.q.type === 'expense' && this.trip?.id) tx.tripId = this.trip.id;
      const id = await this.db.addTransaction(tx);
      this.text = ''; this.q = null;
      this.added.emit();
      this.snack.open('Added', 'Undo', { duration: 4000 }).onAction().subscribe(async () => {
        await this.db.deleteTransaction(id as number);
        this.added.emit();
      });
    } catch {
      this.snack.open('Could not add', 'OK', { duration: 3000 });
    }
    this.busy = false;
  }
}
