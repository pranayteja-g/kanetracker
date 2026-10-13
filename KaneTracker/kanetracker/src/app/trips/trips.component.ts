import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Trip } from '../models/trip.interface';
import { TripSummary, summarizeTrip } from '../shared/trips';
import { InrPipe } from '../shared/inr.pipe';

interface Card { trip: Trip; s: TripSummary }

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, RouterLink, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Trips</h1>
        <a routerLink="/trips/new" class="icon-btn" aria-label="New trip"><mat-icon>add</mat-icon></a>
      </header>

      <ng-container *ngFor="let g of groups">
        <section class="sec" *ngIf="g.items.length">
          <div class="row-h"><h2>{{ g.label }}</h2></div>
          <a class="card" *ngFor="let c of g.items" [routerLink]="['/trips', c.trip.id]">
            <div class="h">
              <b>{{ c.trip.name }}</b>
              <span class="pill" [class.on]="c.s.state === 'active'">{{ status(c) }}</span>
            </div>
            <p class="muted">{{ c.trip.start | date:'d MMM' }} – {{ c.trip.end | date:'d MMM y' }} · {{ c.s.days }} day{{ c.s.days === 1 ? '' : 's' }}</p>
            <ng-container *ngIf="c.s.planned > 0; else noplan">
              <div class="bar"><div [style.width.%]="min100(c.s.pct)" [class.over]="c.s.spent > c.s.planned" [class.near]="c.s.pct >= 80 && c.s.spent <= c.s.planned"></div></div>
              <div class="nums">
                <span>{{ c.s.spent | inr }} <span class="muted">of {{ c.s.planned | inr }}</span></span>
                <b [class.neg]="c.s.left < 0">{{ c.s.left < 0 ? 'Over ' + (-c.s.left | inr) : (c.s.left | inr) + ' left' }}</b>
              </div>
            </ng-container>
            <ng-template #noplan><p class="muted">No plan yet. {{ c.s.spent ? 'Spent ' : '' }}<ng-container *ngIf="c.s.spent">{{ c.s.spent | inr }}</ng-container></p></ng-template>
          </a>
        </section>
      </ng-container>

      <div class="empty" *ngIf="!trips.length">
        <mat-icon>flight_takeoff</mat-icon>
        <p>No trips yet. Plan one: set dates, a budget per category, and track spending day by day.</p>
        <a routerLink="/trips/new" class="btn">Plan a trip</a>
      </div>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; }
    .card { display: block; padding: 14px; margin-bottom: 10px; border: 1px solid var(--k-line); border-radius: var(--k-r); background: var(--k-surface); }
    .h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .h b { font-size: 16px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pill { flex: none; font-size: 12px; padding: 3px 10px; border-radius: 999px; background: var(--k-line); color: var(--k-muted); }
    .pill.on { background: var(--k-ink); color: var(--k-bg); }
    .bar { height: 6px; background: var(--k-line); border-radius: 3px; overflow: hidden; margin: 12px 0 8px; }
    .bar div { height: 100%; background: var(--k-ink); border-radius: 3px; }
    .bar div.near { background: #f59e0b; } .bar div.over { background: #dc2626; }
    .nums { display: flex; justify-content: space-between; font-size: 14px; font-variant-numeric: tabular-nums; }
    .nums b { font-weight: 500; } .neg { color: var(--k-neg); }
  `],
})
export class TripsComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  loaded = false;
  trips: Trip[] = [];
  groups: { label: string; items: Card[] }[] = [];

  async ngOnInit() {
    const [trips, txs] = await Promise.all([this.db.getTrips(), this.db.getAllTransactions()]);
    this.trips = trips;
    const now = new Date();
    const cards = trips.map(trip => ({ trip, s: summarizeTrip(trip, txs, now) }));
    this.groups = [
      { label: 'Now', items: cards.filter(c => c.s.state === 'active') },
      { label: 'Upcoming', items: cards.filter(c => c.s.state === 'upcoming') },
      { label: 'Past', items: cards.filter(c => c.s.state === 'past').reverse() },
    ];
    this.loaded = true;
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/dashboard']); }
  min100(n: number) { return Math.min(100, n); }

  status(c: Card) {
    const s = c.s;
    return s.state === 'active' ? `Day ${s.dayNo}/${s.days}` : s.state === 'upcoming' ? (s.daysToStart === 1 ? 'Tomorrow' : `In ${s.daysToStart} days`) : 'Done';
  }
}
