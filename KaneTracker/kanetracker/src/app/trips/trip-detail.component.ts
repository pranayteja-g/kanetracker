import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Trip } from '../models/trip.interface';
import { Transaction } from '../models/transaction.interface';
import { TripSummary, summarizeTrip } from '../shared/trips';
import { InrPipe } from '../shared/inr.pipe';
import { fmtMoney, getBase } from '../shared/currency';
import { download, fromInput, toCsv, toInput } from '../shared/utils';
import { tripReportRows } from '../shared/trips';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog/transaction-detail-dialog.component';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, RouterLink, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded && trip && s">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>{{ trip.name }}</h1>
        <a class="icon-btn" [routerLink]="['/trips', trip.id, 'edit']" aria-label="Edit trip"><mat-icon>edit</mat-icon></a>
 <button class="icon-btn" (click)="exportReport()" aria-label="Export report (CSV)"><mat-icon>download</mat-icon></button>
        <button class="icon-btn" (click)="dupOpen = !dupOpen" aria-label="Copy plan to new dates"><mat-icon>content_copy</mat-icon></button>
        <button class="icon-btn" (click)="remove()" aria-label="Delete trip"><mat-icon>delete_outline</mat-icon></button>
      </header>
      <p class="muted">{{ trip.start | date:'d MMM' }} – {{ trip.end | date:'d MMM y' }} · {{ statusText }}</p>

      <div class="dup" *ngIf="dupOpen">
        <label><span class="label">Copy this plan to a new trip starting</span>
          <input type="date" [(ngModel)]="dupDate" /></label>
        <button class="btn" (click)="duplicate()" [disabled]="!dupDate">Create copy</button>
      </div>

      <a class="nudge" *ngIf="s.planned <= 0" [routerLink]="['/trips', trip.id, 'edit']"><mat-icon>edit</mat-icon>No budget yet. Tap to plan categories.</a>

      <section class="hero" *ngIf="s.planned > 0">
        <p class="label">{{ s.left >= 0 ? 'Left to spend' : 'Over budget by' }}</p>
        <p class="big" [class.neg]="s.left < 0">{{ s.left >= 0 ? (s.left | inr) : (-s.left | inr) }}</p>
        <p class="muted" *ngIf="foreign">≈ {{ tm(abs(s.left) / trip.rate) }}</p>
        <div class="bar lg"><div [style.width.%]="min100(s.pct)" [class.over]="s.spent > s.planned" [class.near]="s.pct >= 80 && s.spent <= s.planned"></div></div>
        <div class="nums">
          <span>Spent <b>{{ s.spent | inr }}</b></span>
          <span>Planned <b>{{ s.planned | inr }}</b><span class="muted" *ngIf="foreign"> · {{ tm(s.plannedTrip) }}</span></span>
        </div>
      </section>

      <section class="stats" *ngIf="s.planned > 0">
        <ng-container *ngIf="s.state === 'active'">
          <div class="stat"><span class="label">Today</span>
            <b [class.neg]="s.todayLeft < 0">{{ s.todayLeft >= 0 ? (s.todayLeft | inr) : '−' + (-s.todayLeft | inr) }}</b>
            <em>left of {{ s.todayAllowance | inr }} for today</em></div>
          <div class="stat"><span class="label">Per day plan</span><b>{{ s.perDayPlan | inr }}</b><em>{{ s.daysLeft }} day{{ s.daysLeft === 1 ? '' : 's' }} left</em></div>
          <div class="stat wide" *ngIf="s.projected !== null" [class.warn]="s.projected > s.planned">
            <span class="label">At this pace</span>
            <b>{{ s.projected | inr }}</b>
            <em>{{ s.projected > s.planned ? 'about ' + (s.projected - s.planned | inr) + ' over plan' : 'on track, about ' + (s.planned - s.projected | inr) + ' under plan' }}</em></div>
        </ng-container>
        <ng-container *ngIf="s.state === 'upcoming'">
          <div class="stat"><span class="label">Per day</span><b>{{ s.perDayPlan | inr }}</b><em>over {{ s.days }} day{{ s.days === 1 ? '' : 's' }}</em></div>
          <div class="stat" *ngIf="s.savePerMonth"><span class="label">To save</span><b>{{ s.savePerMonth | inr }}</b><em>per month until you go</em></div>
        </ng-container>
        <ng-container *ngIf="s.state === 'past'">
          <div class="stat wide" [class.warn]="s.spent > s.planned">
            <span class="label">Final</span>
            <b>{{ s.spent | inr }} <span class="muted">of {{ s.planned | inr }}</span></b>
            <em>{{ s.spent > s.planned ? (s.spent - s.planned | inr) + ' over budget' : (s.planned - s.spent | inr) + ' under budget' }} · {{ s.spent / s.days | inr }}/day</em></div>
        </ng-container>
      </section>

      <section class="sec" *ngIf="s.rows.length">
        <div class="row-h"><h2>By category</h2></div>
        <div class="cat" *ngFor="let r of s.rows">
          <div class="cat-h">
            <span><i [style.background]="color(r.category)"></i>{{ r.category }}</span>
            <b *ngIf="r.state !== 'unplanned'" [class.neg]="r.state === 'over'">{{ r.spent | inr }} / {{ r.planned | inr }}<span class="muted" *ngIf="foreign"> · {{ tm(r.planned / trip.rate) }}</span></b>
            <b *ngIf="r.state === 'unplanned'">{{ r.spent | inr }} <em class="tag">unplanned</em></b>
          </div>
          <div class="bar" *ngIf="r.state !== 'unplanned'"><div [style.width.%]="min100(r.pct)" [style.background]="r.state === 'over' ? '#dc2626' : r.state === 'near' ? '#f59e0b' : color(r.category)"></div></div>
          <p class="left" *ngIf="r.state !== 'unplanned'" [class.neg]="r.state === 'over'">{{ r.left >= 0 ? (r.left | inr) + ' left' : 'Over by ' + (-r.left | inr) }}<span class="muted" *ngIf="foreign"> · ≈ {{ tm(abs(r.left) / trip.rate) }}</span></p>
        </div>
      </section>

      <section class="sec" *ngIf="s.spent > 0 && s.days <= 60">
        <div class="row-h"><h2>Day by day</h2><span class="muted" *ngIf="s.outside">+ {{ s.outside | inr }} outside the dates</span></div>
        <div class="chart" role="img" aria-label="Spending per day of the trip">
          <div class="plan" *ngIf="s.perDayPlan > 0" [style.bottom.%]="(s.perDayPlan / chartMax) * 100"></div>
          <div class="col" *ngFor="let d of s.daily; let i = index" [class.today]="s.state === 'active' && i === s.dayNo - 1">
            <div class="b" [style.height.%]="(d.amount / chartMax) * 100" [class.hi]="d.amount > s.perDayPlan && s.perDayPlan > 0"></div>
            <span>{{ d.date | date:'d' }}</span>
          </div>
        </div>
        <p class="muted">Line = planned per day ({{ s.perDayPlan | inr }}).</p>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Expenses</h2><a [routerLink]="['/transaction-form']" [queryParams]="{ trip: trip.id }">+ Add</a></div>
        <button class="tx" *ngFor="let t of txs" (click)="open(t)">
          <i [style.background]="color(t.category)"></i>
          <span class="m"><b>{{ t.category }}</b><span>{{ t.description ? t.description + ' · ' : '' }}{{ t.date | date:'d MMM' }}</span></span>
          <span class="a">−{{ t.amount | inr }}</span>
        </button>
        <p class="muted none" *ngIf="!txs.length">No expenses linked yet. Add one and it counts here.</p>
      </section>

      <section class="sec" *ngIf="trip.notes"><div class="row-h"><h2>Notes</h2></div><p class="notes">{{ trip.notes }}</p></section>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 0; } .top h1 { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 4px; }
    .dup { display: flex; gap: 8px; align-items: flex-end; margin: 12px 0; }
    .dup label { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .dup input { min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; }
    .nudge { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 12px; border-radius: var(--k-r); background: var(--k-warn-bg); color: var(--k-warn); font-size: 13px; }
    .hero { padding: 20px 0 4px; }
    .big { font-size: 40px; font-weight: 600; letter-spacing: -.03em; line-height: 1.1; margin: 4px 0; font-variant-numeric: tabular-nums; }
    .neg { color: var(--k-neg); }
    .bar { height: 4px; background: var(--k-line); border-radius: 2px; overflow: hidden; }
    .bar.lg { height: 8px; border-radius: 4px; margin: 12px 0 8px; }
    .bar div { height: 100%; background: var(--k-ink); border-radius: inherit; }
    .bar div.near { background: #f59e0b; } .bar div.over { background: #dc2626; }
    .nums { display: flex; justify-content: space-between; font-size: 14px; }
    .nums b { font-weight: 600; font-variant-numeric: tabular-nums; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
    .stat { padding: 12px; border: 1px solid var(--k-line); border-radius: var(--k-r); background: var(--k-surface); display: flex; flex-direction: column; gap: 2px; }
    .stat.wide { grid-column: 1 / -1; } .stat.warn { border-color: #f59e0b; }
    .stat b { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stat em { font-style: normal; font-size: 12px; color: var(--k-muted); }
    .cat { margin-bottom: 14px; }
    .cat-h { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; gap: 8px; }
    .cat-h span { display: flex; align-items: center; gap: 8px; min-width: 0; } .cat-h i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .cat-h b { font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; }
    .tag { font-style: normal; font-size: 11px; color: var(--k-muted); margin-left: 4px; }
    .left { font-size: 12px; color: var(--k-muted); margin-top: 4px; }
    .chart { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 140px; padding-bottom: 18px; overflow-x: auto; }
    .plan { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--k-muted); margin-bottom: 18px; pointer-events: none; z-index: 1; }
    .col { position: relative; flex: 1; min-width: 22px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
    .col .b { width: 100%; background: var(--k-ink); opacity: .75; border-radius: 3px 3px 0 0; min-height: 0; }
    .col .b.hi { background: #dc2626; opacity: .85; }
    .col.today .b { opacity: 1; }
    .col span { position: absolute; bottom: -16px; font-size: 11px; color: var(--k-muted); }
    .col.today span { color: var(--k-ink); font-weight: 600; }
    .none { text-align: center; padding: 24px 0; }
    .notes { white-space: pre-wrap; font-size: 14px; }
  `],
})
export class TripDetailComponent implements OnInit {
  private db = inject(DexieService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  loaded = false;
  trip?: Trip;
  s?: TripSummary;
  txs: Transaction[] = [];
  dupOpen = false;
  dupDate = '';
  chartMax = 1;
  private colors = new Map<string, string>();

  get foreign() { return !!this.trip && this.trip.currency !== getBase(); }

  get statusText() {
    const s = this.s!;
    return s.state === 'active' ? `Day ${s.dayNo} of ${s.days}, ${s.daysLeft} left`
      : s.state === 'upcoming' ? (s.daysToStart === 1 ? 'Starts tomorrow' : `Starts in ${s.daysToStart} days`) + ` · ${s.days} day${s.days === 1 ? '' : 's'}`
      : `Finished · ${s.days} day${s.days === 1 ? '' : 's'}`;
  }

  async ngOnInit() { await this.load(); }

  private async load() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const [trip, all, cats] = await Promise.all([this.db.trips.get(id), this.db.getAllTransactions(), this.db.getAllCategories()]);
    if (!trip) { this.router.navigate(['/trips'], { replaceUrl: true }); return; }
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.trip = trip;
    const now = new Date();
    this.s = summarizeTrip(trip, all, now);
    this.chartMax = Math.max(1, this.s.perDayPlan, ...this.s.daily.map(d => d.amount));
    this.txs = all.filter(t => t.tripId === id && t.type === 'expense').sort((a, b) => b.date.localeCompare(a.date));
    const end = new Date(trip.end);
    const next = new Date(Math.max(Date.now(), end.getTime() + 864e5));
    this.dupDate = toInput(next);
    this.loaded = true;
  }

  exportReport() {
    if (!this.trip || !this.s) return;
    const slug = this.trip.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'trip';
    download(`trip-${slug}-${toInput(new Date())}.csv`, 'text/csv', toCsv(tripReportRows(this.trip, this.s, this.txs)));
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/trips']); }
  min100(n: number) { return Math.min(100, n); }
  abs(n: number) { return Math.abs(n); }
  color(n: string) { return this.colors.get(n) || '#a3a3a3'; }
  tm(n: number) { return fmtMoney(n, this.trip!.currency); }

  open(t: Transaction) {
    this.dialog
      .open(TransactionDetailDialogComponent, { width: '500px', maxWidth: '95vw', data: { transaction: t } })
      .afterClosed()
      .subscribe(r => (r?.updated || r?.deleted || r?.duplicated) && this.load());
  }

  async duplicate() {
    if (!this.trip?.id || !this.dupDate) return;
    try {
      const nid = await this.db.duplicateTrip(this.trip.id, fromInput(this.dupDate));
      this.snack.open('Plan copied. Adjust dates and amounts.', undefined, { duration: 2500 });
      this.router.navigate(['/trips', nid, 'edit']);
    } catch {
      this.snack.open('Copy failed', 'OK', { duration: 3000 });
    }
  }

  async remove() {
    if (!this.trip?.id) return;
    const n = this.txs.length;
    if (!confirm(`Delete "${this.trip.name}"?${n ? ` Its ${n} expense${n === 1 ? '' : 's'} stay in your history, just unlinked from the trip.` : ''}`)) return;
    try {
      const undo = await this.db.deleteTripWithUndo(this.trip.id);
      this.router.navigate(['/trips'], { replaceUrl: true });
      this.snack.open('Trip deleted', 'Undo', { duration: 6000 }).onAction().subscribe(async () => {
        await undo();
        this.snack.open('Trip restored', undefined, { duration: 1500 });
        this.router.navigate(['/trips']);
      });
    } catch {
      this.snack.open('Delete failed', 'OK', { duration: 3000 });
    }
  }
}
