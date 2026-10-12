import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { InrPipe } from '../shared/inr.pipe';

interface Row { name: string; cur: number; prev: number; color: string; delta: number }

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [NgFor, NgIf, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Monthly summary</h1><span class="sp"></span>
      </header>

      <div class="nav">
        <button class="icon-btn" (click)="shift(-1)" aria-label="Previous month"><mat-icon>chevron_left</mat-icon></button>
        <b>{{ label }}</b>
        <button class="icon-btn" (click)="shift(1)" [disabled]="isNow" aria-label="Next month"><mat-icon>chevron_right</mat-icon></button>
      </div>

      <div class="grid">
        <div><span class="label">Income</span><b class="inc">{{ inc | inr }}</b><em [class.good]="incD >= 0">{{ fmt(incD, prevInc) }}</em></div>
        <div><span class="label">Spent</span><b>{{ exp | inr }}</b><em [class.good]="expD <= 0">{{ fmt(expD, prevExp) }}</em></div>
        <div><span class="label">Saved</span><b [class.neg]="inc - exp < 0">{{ inc - exp | inr }}</b><em>{{ rate }}</em></div>
        <div><span class="label">Txns</span><b>{{ count }}</b><em>vs {{ prevCount }} prev</em></div>
      </div>

      <section class="sec" *ngIf="rows.length">
        <div class="row-h"><h2>Spend vs previous month</h2></div>
        <div class="c" *ngFor="let r of rows">
          <div class="h"><span><i [style.background]="r.color"></i>{{ r.name }}</span>
            <b>{{ r.cur | inr }} <em [class.good]="r.delta <= 0">{{ fmt(r.delta, r.prev) }}</em></b></div>
          <div class="bar"><div class="p" [style.width.%]="r.prev / max * 100"></div><div class="cu" [style.width.%]="r.cur / max * 100" [style.background]="r.color"></div></div>
        </div>
        <p class="muted">Thin grey = last month.</p>
      </section>
      <p class="muted empty" *ngIf="!rows.length && !count">No data this month</p>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .nav { display: flex; align-items: center; justify-content: space-between; }
    .icon-btn:disabled { opacity: .25; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 16px; margin-top: 16px; }
    .grid div { display: flex; flex-direction: column; gap: 2px; }
    .grid b { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    em { font-style: normal; font-size: 12px; color: #dc2626; } em.good { color: var(--k-income); }
        .neg { color: #dc2626; }
    .c { margin-bottom: 14px; } .h { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
    .h span { display: flex; align-items: center; gap: 8px; } .h i { width: 8px; height: 8px; border-radius: 50%; }
    .h b { font-weight: 500; font-variant-numeric: tabular-nums; }
    .bar { position: relative; height: 8px; }
    .p { position: absolute; top: 0; height: 2px; background: var(--k-muted); opacity: .5; }
    .cu { position: absolute; top: 4px; height: 4px; border-radius: 2px; }
    .empty { text-align: center; padding: 48px 0; }
  `],
})
export class SummaryComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  loaded = false;
  offset = 0; // months back
  label = '';
  inc = 0; exp = 0; prevInc = 0; prevExp = 0; count = 0; prevCount = 0;
  rows: Row[] = [];
  max = 1;
  private all: { t: number; a: number; type: string; c: string }[] = [];
  private colors = new Map<string, string>();

  get isNow() { return this.offset === 0; }
  get incD() { return this.inc - this.prevInc; }
  get expD() { return this.exp - this.prevExp; }
  get rate() { return this.inc > 0 ? `${Math.round(((this.inc - this.exp) / this.inc) * 100)}% of income` : ''; }

  async ngOnInit() {
    const [txs, cats] = await Promise.all([this.db.getAllTransactions(), this.db.getAllCategories()]);
    this.all = txs.map(t => ({ t: new Date(t.date).getTime(), a: t.amount, type: t.type, c: t.category }));
    cats.forEach(c => this.colors.set(c.name, c.color));
    this.compute();
    this.loaded = true;
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/dashboard']); }
  shift(n: number) { this.offset = Math.max(0, this.offset - n); this.compute(); }

  fmt(d: number, prev: number) {
    if (!prev) return d ? 'new' : '—';
    const p = Math.round((d / prev) * 100);
    return `${p > 0 ? '▲' : p < 0 ? '▼' : ''} ${Math.abs(p)}%`;
  }

  private compute() {
    const n = new Date();
    const s = new Date(n.getFullYear(), n.getMonth() - this.offset, 1);
    const cs = s.getTime(), ce = new Date(s.getFullYear(), s.getMonth() + 1, 1).getTime();
    const ps = new Date(s.getFullYear(), s.getMonth() - 1, 1).getTime();
    this.label = s.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    this.inc = this.exp = this.prevInc = this.prevExp = this.count = this.prevCount = 0;
    const cur = new Map<string, number>(), prev = new Map<string, number>();
    for (const t of this.all) {
      const inCur = t.t >= cs && t.t < ce, inPrev = t.t >= ps && t.t < cs;
      if (!inCur && !inPrev) continue;
      if (inCur) { this.count++; if (t.type === 'income') this.inc += t.a; else { this.exp += t.a; cur.set(t.c, (cur.get(t.c) || 0) + t.a); } }
      else { this.prevCount++; if (t.type === 'income') this.prevInc += t.a; else { this.prevExp += t.a; prev.set(t.c, (prev.get(t.c) || 0) + t.a); } }
    }
    const names = new Set([...cur.keys(), ...prev.keys()]);
    this.rows = [...names].map(name => {
      const c = cur.get(name) || 0, p = prev.get(name) || 0;
      return { name, cur: c, prev: p, color: this.colors.get(name) || '#a3a3a3', delta: c - p };
    }).sort((a, b) => b.cur - a.cur).slice(0, 10);
    this.max = Math.max(1, ...this.rows.map(r => Math.max(r.cur, r.prev)));
  }
}
