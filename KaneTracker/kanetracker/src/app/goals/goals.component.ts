import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Trip } from '../models/trip.interface';
import { InrPipe } from '../shared/inr.pipe';
import { Goal, GoalView, viewGoal } from '../shared/goals';
import { planTotal } from '../shared/trips';
import { toInput } from '../shared/utils';

interface Card { g: Goal; v: GoalView; trip?: Trip; deadline?: string }

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Savings goals</h1>
        <button class="icon-btn" (click)="adding = !adding" aria-label="New goal"><mat-icon>{{ adding ? 'close' : 'add' }}</mat-icon></button>
      </header>

      <section class="sec form" *ngIf="adding">
        <label class="f"><span class="label">Name</span><input type="text" maxlength="40" [(ngModel)]="name" placeholder="Japan fund" /></label>
        <label class="f" *ngIf="trips.length"><span class="label">Link to a trip (optional)</span>
          <select [(ngModel)]="tripId" (ngModelChange)="onTrip()"><option [ngValue]="0">None</option><option *ngFor="let t of trips" [ngValue]="t.id">{{ t.name }}</option></select></label>
        <p class="muted" *ngIf="tripId">Target follows the trip plan; deadline is the trip start.</p>
        <ng-container *ngIf="!tripId">
          <label class="f"><span class="label">Target</span><input type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="target" placeholder="e.g. 100000" /></label>
          <label class="f"><span class="label">Deadline (optional)</span><input type="date" [(ngModel)]="deadline" [min]="today" /></label>
        </ng-container>
        <p class="err" *ngIf="err">{{ err }}</p>
        <button class="btn full" (click)="add()">Create goal</button>
      </section>

      <p class="muted none" *ngIf="!cards.length && !adding">No goals yet. Tap + to save towards something, like a trip or a gadget.</p>

      <section class="card" *ngFor="let c of cards">
        <div class="h"><b>{{ c.g.name }}</b><button class="x" (click)="remove(c.g)" aria-label="Delete goal"><mat-icon>delete_outline</mat-icon></button></div>
        <div class="bar"><div [style.width.%]="c.v.pct" [class.done]="c.v.state === 'done'"></div></div>
        <div class="nums"><span>{{ c.v.savedSum | inr }} <span class="muted">of {{ c.v.target | inr }}</span></span>
          <b>{{ c.v.state === 'done' ? 'Reached' : (c.v.left | inr) + ' to go' }}</b></div>
        <p class="muted" *ngIf="c.v.state !== 'done' && c.deadline">
          By {{ c.deadline | date:'d MMM y' }}:
          <ng-container *ngIf="c.v.state === 'late'">deadline passed.</ng-container>
          <ng-container *ngIf="c.v.state === 'on' && c.v.perMonth !== null">save {{ c.v.perMonth | inr }}{{ c.v.monthsLeft && c.v.monthsLeft > 1 ? '/month' : ' now' }}.</ng-container>
        </p>
        <div class="row2">
          <input type="number" inputmode="decimal" step="any" [(ngModel)]="amt[c.g.id]" placeholder="Add (use − to take out)" [attr.aria-label]="'Add to ' + c.g.name" />
          <button class="btn" (click)="contribute(c.g)" [disabled]="!amt[c.g.id]">Save</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; }
    .none { text-align: center; padding: 48px 0; }
    .f { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
    .f input, .f select, .row2 input { min-height: 48px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; box-sizing: border-box; width: 100%; min-width: 0; }
    .full { width: 100%; margin-top: 16px; } .err { color: #dc2626; font-size: 14px; }
    .card { padding: 14px; margin-bottom: 10px; border: 1px solid var(--k-line); border-radius: var(--k-r); background: var(--k-surface); }
    .h { display: flex; justify-content: space-between; align-items: center; } .h b { font-size: 16px; font-weight: 600; }
    .x { border: 0; background: none; color: var(--k-muted); display: grid; place-items: center; }
    .bar { height: 6px; background: var(--k-line); border-radius: 3px; overflow: hidden; margin: 12px 0 8px; }
    .bar div { height: 100%; background: var(--k-ink); border-radius: 3px; } .bar div.done { background: #16a34a; }
    .nums { display: flex; justify-content: space-between; font-size: 14px; }
    .row2 { display: flex; gap: 8px; margin-top: 12px; } .row2 .btn { min-height: 48px; padding: 0 16px; }
  `],
})
export class GoalsComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  loaded = false;
  adding = false;
  cards: Card[] = [];
  trips: Trip[] = [];
  name = '';
  target: number | null = null;
  deadline = '';
  tripId = 0;
  err = '';
  amt: Record<string, number | null> = {};
  today = toInput(new Date());
  private goals: Goal[] = [];

  async ngOnInit() { await this.load(); this.loaded = true; }

  private async load() {
    [this.goals, this.trips] = await Promise.all([this.db.getSetting<Goal[]>('goals', []), this.db.getTrips()]);
    const now = new Date();
    this.cards = this.goals.map(g => {
      const trip = g.tripId ? this.trips.find(t => t.id === g.tripId) : undefined;
      const target = trip ? planTotal(trip.plan) : g.target;
      const deadline = trip ? trip.start : g.deadline;
      return { g, trip, deadline, v: viewGoal(g, now, target, deadline) };
    });
  }

  onTrip() { const t = this.trips.find(x => x.id === this.tripId); if (t && !this.name.trim()) this.name = t.name + ' fund'; }

  async add() {
    this.err = '';
    const trip = this.trips.find(t => t.id === this.tripId);
    const target = trip ? planTotal(trip.plan) : Number(this.target);
    if (!this.name.trim()) { this.err = 'Give it a name.'; return; }
    if (!(target > 0) || !isFinite(target)) { this.err = trip ? 'That trip has no budget yet.' : 'Enter a target.'; return; }
    const g: Goal = { id: Date.now().toString(36), name: this.name.trim(), target: Math.round(target * 100) / 100, saved: [],
      ...(trip ? { tripId: trip.id } : this.deadline ? { deadline: new Date(this.deadline + 'T12:00:00').toISOString() } : {}) };
    await this.db.setSetting('goals', [...this.goals, g]);
    this.name = ''; this.target = null; this.deadline = ''; this.tripId = 0; this.adding = false;
    await this.load();
  }

  async contribute(g: Goal) {
    const a = Number(this.amt[g.id]);
    if (!a || !isFinite(a)) return;
    const goals = this.goals.map(x => x.id === g.id ? { ...x, saved: [...x.saved, { id: Date.now().toString(36), amount: Math.round(a * 100) / 100, date: new Date().toISOString() }] } : x);
    await this.db.setSetting('goals', goals);
    this.amt[g.id] = null;
    await this.load();
    this.snack.open('Saved', undefined, { duration: 1500 });
  }

  async remove(g: Goal) {
    if (!confirm(`Delete goal "${g.name}"?`)) return;
    await this.db.setSetting('goals', this.goals.filter(x => x.id !== g.id));
    await this.load();
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }
}
