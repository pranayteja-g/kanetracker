import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { InrPipe } from '../shared/inr.pipe';
import { YearSummary, summarizeYear } from '../shared/year';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-year',
  standalone: true,
  imports: [NgFor, NgIf, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Year review</h1><span class="sp"></span>
      </header>
      <div class="yr">
        <button class="icon-btn" (click)="go(-1)" aria-label="Previous year"><mat-icon>chevron_left</mat-icon></button>
        <b>{{ y.year }}</b>
        <button class="icon-btn" (click)="go(1)" [disabled]="y.year >= thisYear" aria-label="Next year"><mat-icon>chevron_right</mat-icon></button>
      </div>

      <p class="muted none" *ngIf="!y.count">Nothing recorded in {{ y.year }}.</p>
      <ng-container *ngIf="y.count">
        <section class="hero">
          <p class="label">Saved</p>
          <p class="big" [class.neg]="y.saved < 0">{{ y.saved < 0 ? '−' : '' }}{{ abs(y.saved) | inr }}</p>
          <p class="muted" *ngIf="y.rate !== null">{{ round(y.rate) }}% of income</p>
          <div class="split">
            <div><span class="label">Income</span><b class="inc">{{ y.income | inr }}</b></div>
            <div><span class="label">Spent</span><b>{{ y.spent | inr }}</b></div>
          </div>
        </section>

        <section class="sec">
          <div class="row-h"><h2>Month by month</h2><span class="muted"><i class="k inc"></i>income <i class="k sp2"></i>spent</span></div>
          <div class="chart" role="img" aria-label="Income and spending per month">
            <div class="col" *ngFor="let m of y.months">
              <div class="bars">
                <div class="b i" [style.height.%]="(m.income / y.maxMonth) * 100"></div>
                <div class="b s" [style.height.%]="(m.spent / y.maxMonth) * 100"></div>
              </div>
              <span>{{ mn[m.m][0] }}</span>
            </div>
          </div>
          <p class="muted">Average spend {{ y.avgMonthly | inr }}/month<ng-container *ngIf="y.bigMonth !== null"> · biggest month {{ mn[y.bigMonth] }} ({{ y.months[y.bigMonth].spent | inr }})</ng-container><ng-container *ngIf="y.bestMonth !== null"> · best saving month {{ mn[y.bestMonth] }}</ng-container></p>
        </section>

        <section class="sec" *ngIf="y.top.length">
          <div class="row-h"><h2>Top categories</h2></div>
          <div class="cat" *ngFor="let c of y.top">
            <div class="cat-h"><span><i [style.background]="color(c.name)"></i>{{ c.name }}</span><b>{{ c.amount | inr }}</b></div>
            <div class="bar"><div [style.width.%]="c.pct" [style.background]="color(c.name)"></div></div>
          </div>
        </section>
      </ng-container>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .yr { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 18px; }
    .none { text-align: center; padding: 48px 0; }
    .split { display: flex; gap: 32px; margin-top: 16px; } .split div { display: flex; flex-direction: column; gap: 2px; }
    .split b { font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; }
    .chart { display: flex; gap: 4px; height: 140px; align-items: flex-end; margin: 12px 0 8px; }
    .col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px; font-size: 11px; color: var(--k-muted); }
    .bars { flex: 1; width: 100%; display: flex; align-items: flex-end; gap: 1px; }
    .b { flex: 1; min-height: 2px; border-radius: 2px 2px 0 0; } .b.i { background: #16a34a; opacity: .75; } .b.s { background: var(--k-ink); }
    .k { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin: 0 4px 0 8px; background: #16a34a; } .k.sp2 { background: var(--k-ink); }
    .cat { margin-bottom: 14px; } .cat-h { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
    .cat-h span { display: flex; align-items: center; gap: 8px; } .cat-h i { width: 8px; height: 8px; border-radius: 50%; }
    .cat-h b { font-weight: 500; font-variant-numeric: tabular-nums; }
    .bar { height: 4px; background: var(--k-line); border-radius: 2px; overflow: hidden; } .bar div { height: 100%; border-radius: 2px; }
  `],
})
export class YearComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);

  mn = MN;
  thisYear = new Date().getFullYear();
  loaded = false;
  y!: YearSummary;
  abs = Math.abs;
  round = Math.round;
  private txs: Transaction[] = [];
  private colors = new Map<string, string>();

  async ngOnInit() {
    const [txs, cats] = await Promise.all([this.db.getAllTransactions(), this.db.getAllCategories()]);
    this.txs = txs;
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.y = summarizeYear(txs, this.thisYear);
    this.loaded = true;
  }

  go(d: number) { this.y = summarizeYear(this.txs, Math.min(this.thisYear, this.y.year + d)); }
  color(n: string) { return this.colors.get(n) || '#d4d4d4'; }
  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }
}
