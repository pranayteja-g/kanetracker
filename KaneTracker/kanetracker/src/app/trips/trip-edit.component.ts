import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';
import { Trip } from '../models/trip.interface';
import { Transaction } from '../models/transaction.interface';
import { CURRENCIES, fmtMoney, getBase, symbol } from '../shared/currency';
import { MAX_TRIP_DAYS, TRIP_CATEGORIES, pastTripDailyAvg, pastTripWeights, splitTotal, templateWeights, tripDays } from '../shared/trips';
import { fromInput, toInput } from '../shared/utils';

@Component({
  selector: 'app-trip-edit',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MatIconModule],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>{{ id ? 'Edit trip' : 'New trip' }}</h1><span class="sp"></span>
      </header>

      <label class="f"><span class="label">Name</span>
        <input type="text" maxlength="60" [(ngModel)]="name" placeholder="Goa with friends" autocomplete="off" /></label>

      <div class="two">
        <label class="f"><span class="label">Start</span><input type="date" [(ngModel)]="start" (ngModelChange)="onStart()" /></label>
        <label class="f"><span class="label">End</span><input type="date" [(ngModel)]="end" [min]="start" /></label>
      </div>
      <p class="muted" *ngIf="days > 0">{{ days }} day{{ days === 1 ? '' : 's' }}</p>
      <p class="err" *ngIf="days > MAX">Trips can be at most {{ MAX }} days.</p>
      <p class="err" *ngIf="start && end && days <= 0">End must be on or after the start.</p>

      <div class="two">
        <label class="f"><span class="label">Trip currency</span>
          <select [(ngModel)]="currency" (ngModelChange)="onCurrency()">
            <option *ngFor="let c of currencies" [value]="c">{{ c }} {{ sym(c) }}{{ c === base ? ' (main)' : '' }}</option>
          </select></label>
        <label class="f" *ngIf="currency !== base"><span class="label">1 {{ currency }} = ? {{ base }}</span>
          <input type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="rate" /></label>
      </div>

      <section class="sec">
        <div class="row-h"><h2>Budget per category</h2></div>
        <div class="tot">
          <label class="f"><span class="label">Total budget ({{ base }})</span>
            <input type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="totalIn" placeholder="e.g. 25000" /></label>
          <button class="btn ghost" (click)="autoSplit()" [disabled]="!(totalIn && totalIn > 0)">Auto-split</button>
          <button class="btn ghost" (click)="evenSplit()" [disabled]="!(totalIn && totalIn > 0)">Even</button>
        </div>
        <p class="hint" *ngIf="dailyAvg && days > 0">
          Your past trips averaged {{ baseMoney(dailyAvg) }}/day, so about {{ baseMoney(dailyAvg * days) }} for {{ days }} days.
          <button class="link" (click)="useSuggested()">Use</button>
        </p>
        <p class="muted" *ngIf="weightsFrom">Auto-split uses {{ weightsFrom === 'past' ? 'what your past trips actually cost' : 'a typical trip mix (stay, food, transport…)' }}. Edit any amount after.</p>

        <div class="row" *ngFor="let c of cats">
          <span class="nm"><i [style.background]="c.color"></i>{{ c.name }}</span>
          <div class="inp"><input type="number" inputmode="decimal" min="0" step="any" placeholder="0" [(ngModel)]="amounts[c.name]" [attr.aria-label]="c.name + ' budget'" />
            <small *ngIf="foreign && amounts[c.name]">≈ {{ money(local(+amounts[c.name]!)) }}</small></div>
        </div>
        <button class="link more" *ngIf="more.length" (click)="showMore = !showMore">{{ showMore ? 'Hide' : 'More categories (' + more.length + ')' }}</button>
        <ng-container *ngIf="showMore">
          <div class="row" *ngFor="let c of more">
            <span class="nm"><i [style.background]="c.color"></i>{{ c.name }}</span>
            <div class="inp"><input type="number" inputmode="decimal" min="0" step="any" placeholder="0" [(ngModel)]="amounts[c.name]" [attr.aria-label]="c.name + ' budget'" />
              <small *ngIf="foreign && amounts[c.name]">≈ {{ money(local(+amounts[c.name]!)) }}</small></div>
          </div>
        </ng-container>

        <div class="sum">
          <span>Plan total</span>
          <b>{{ baseMoney(total) }}</b>
        </div>
        <p class="muted" *ngIf="foreign && total > 0">≈ {{ money(local(total)) }}</p>
        <p class="muted" *ngIf="days > 0 && total > 0">{{ baseMoney(total / days) }} per day</p>
      </section>

      <label class="f"><span class="label">Notes (optional)</span>
        <textarea rows="2" maxlength="500" [(ngModel)]="notes" placeholder="Bookings, who pays what…"></textarea></label>

      <p class="err" *ngIf="err">{{ err }}</p>
      <div class="bar"><button class="btn save" (click)="save()" [disabled]="saving">{{ saving ? 'Saving…' : 'Save trip' }}</button></div>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .f { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; flex: 1; min-width: 0; }
    .f input, .f select, .f textarea, .row input { min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; box-sizing: border-box; width: 100%; }
    .f textarea { padding: 12px; min-height: 64px; resize: vertical; }
    .two { display: flex; gap: 8px; }
    .tot { display: flex; gap: 8px; align-items: flex-end; }
    .tot .btn { min-height: 48px; padding: 0 14px; }
    .hint { font-size: 13px; margin: 8px 0 0; color: var(--k-ink); }
    .link { border: 0; background: none; color: var(--k-accent); font: inherit; font-weight: 500; padding: 0 4px; }
    .row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--k-line); }
    .row:last-of-type { border-bottom: 0; }
    .nm { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .nm i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
    .inp { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .inp small { font-size: 12px; color: var(--k-muted); }
    .more { padding: 10px 0 0; }
    .row input { width: 130px; text-align: right; }
    .sum { display: flex; justify-content: space-between; padding: 14px 0 4px; font-size: 16px; }
    .sum b { font-variant-numeric: tabular-nums; }
    .err { color: #dc2626; font-size: 14px; margin-top: 8px; }
    .bar { position: sticky; bottom: calc(12px + env(safe-area-inset-bottom)); margin-top: 20px; padding-top: 12px; background: linear-gradient(transparent, var(--k-bg) 30%); }
    .save { width: 100%; font-size: 16px; }
  `],
})
export class TripEditComponent implements OnInit {
  private db = inject(DexieService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  readonly MAX = MAX_TRIP_DAYS;
  base = getBase();
  sym = symbol;
  loaded = false;
  saving = false;
  err = '';

  id: number | null = null;
  name = '';
  start = toInput(new Date());
  end = toInput(new Date(Date.now() + 2 * 864e5));
  currency = getBase();
  rate: number | null = 1;
  notes = '';
  totalIn: number | null = null;
  amounts: Record<string, number | null> = {};
  cats: Category[] = [];
  more: Category[] = [];
  showMore = false;
  currencies: string[] = [];
  dailyAvg: number | null = null;
  weightsFrom: 'past' | 'template' | '' = '';

  private rates: Record<string, number> = {};
  private pastW: Record<string, number> | null = null;

  get days() {
    if (!this.start || !this.end) return 0;
    return tripDays({ start: fromInput(this.start).toISOString(), end: fromInput(this.end).toISOString() });
  }

  get total() {
    return Object.values(this.amounts).reduce<number>((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
  }

  async ngOnInit() {
    const idp = this.route.snapshot.paramMap.get('id');
    const [cats, trips, txs, rates] = await Promise.all([
      this.db.getCategoriesByType('expense'), this.db.getTrips(), this.db.getAllTransactions(), this.db.getRates(),
    ]);
    // trip set first (existing match or virtual, created on save); other expense categories behind a toggle
    const low = (x: string) => x.toLowerCase().trim();
    const main: Category[] = TRIP_CATEGORIES.map(tc => cats.find(c => low(c.name) === low(tc.name)) ?? { name: tc.name, color: tc.color, type: 'expense' as const });
    this.cats = main;
    this.more = cats.filter(c => !main.some(m => low(m.name) === low(c.name)));
    this.rates = rates;
    this.currencies = [this.base, ...CURRENCIES.map(c => c.code).filter(c => c !== this.base)];
    const now = new Date();
    this.pastW = pastTripWeights(trips, txs as Transaction[], now);
    const avg = pastTripDailyAvg(trips, txs as Transaction[], now);
    this.dailyAvg = avg;

    if (idp) {
      const t = trips.find(x => x.id === Number(idp));
      if (!t) { this.router.navigate(['/trips']); return; }
      this.id = t.id!;
      this.name = t.name;
      this.start = toInput(new Date(t.start));
      this.end = toInput(new Date(t.end));
      this.currency = t.currency;
      if (!this.currencies.includes(t.currency)) this.currencies.push(t.currency);
      this.rate = t.rate;
      this.notes = t.notes || '';
      t.plan.forEach(l => (this.amounts[l.category] = l.amount));
      // categories that exist in the plan but were deleted/renamed elsewhere stay editable
      for (const l of t.plan) {
        if (this.cats.some(c => c.name === l.category)) continue;
        const mi = this.more.findIndex(c => c.name === l.category);
        this.cats.push(mi >= 0 ? this.more.splice(mi, 1)[0] : { name: l.category, color: '#a3a3a3', type: 'expense' });
      }
    }
    [...this.cats, ...this.more].forEach(c => { if (!(c.name in this.amounts)) this.amounts[c.name] = null; });
    this.loaded = true;
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/trips']); }
  get foreign() { return this.currency !== this.base && Number(this.rate) > 0; }
  local(n: number) { return n / Number(this.rate); }
  money(n: number) { return fmtMoney(n, this.currency); }
  baseMoney(n: number) { return fmtMoney(n, this.base); }

  onStart() {
    if (this.end && this.start && this.end < this.start) this.end = this.start;
  }

  onCurrency() {
    this.rate = this.currency === this.base ? 1 : (this.rates[this.currency] ?? null);
  }

  useSuggested() {
    if (this.dailyAvg && this.days > 0) {
      this.totalIn = Math.round(this.dailyAvg * this.days);
    }
  }

  autoSplit() {
    const names = this.cats.map(c => c.name);
    const w = this.pastW ?? templateWeights(names);
    this.weightsFrom = this.pastW ? 'past' : 'template';
    // a category with a zero weight gets nothing
    this.apply(splitTotal(Number(this.totalIn), names, names.reduce<Record<string, number>>((o, n) => ((o[n] = w[n] ?? 0), o), {})));
  }

  evenSplit() {
    this.weightsFrom = '';
    const names = this.cats.map(c => c.name);
    this.apply(splitTotal(Number(this.totalIn), names, null));
  }

  private apply(split: Record<string, number>) {
    for (const [k, v] of Object.entries(split)) this.amounts[k] = v > 0 ? v : null;
  }

  async save() {
    this.err = '';
    const name = this.name.trim();
    const rate = this.currency === this.base ? 1 : Number(this.rate);
    if (!name) { this.err = 'Give the trip a name.'; return; }
    if (!this.start || !this.end || this.days <= 0) { this.err = 'Pick valid dates.'; return; }
    if (this.days > MAX_TRIP_DAYS) { this.err = `Trips can be at most ${MAX_TRIP_DAYS} days.`; return; }
    if (!(rate > 0) || !isFinite(rate)) { this.err = 'Enter the exchange rate.'; return; }
    const plan = Object.entries(this.amounts)
      .filter(([, v]) => Number(v) > 0)
      .map(([category, v]) => ({ category, amount: Math.round(Number(v) * 100) / 100 }));
    const trip: Trip = {
      name, start: fromInput(this.start).toISOString(), end: fromInput(this.end).toISOString(),
      currency: this.currency, rate, plan, planBase: true, ...(this.notes.trim() ? { notes: this.notes.trim() } : {}),
    };
    this.saving = true;
    try {
      await this.db.ensureTripCategories();
      if (this.id) { await this.db.trips.put({ ...trip, id: this.id }); }
      else this.id = await this.db.trips.add(trip);
      this.snack.open('Trip saved', undefined, { duration: 1500 });
      this.router.navigate(['/trips', this.id], { replaceUrl: true });
    } catch {
      this.err = 'Could not save. Try again.';
      this.saving = false;
    }
  }
}
