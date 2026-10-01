import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MatIconModule],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Budgets</h1><span class="sp"></span>
      </header>
      <p class="muted">Monthly limit per expense category. Leave blank for none.</p>
      <div class="row" *ngFor="let c of cats">
        <span class="nm"><i [style.background]="c.color"></i>{{ c.name }}</span>
        <span class="r">₹</span>
        <input type="number" inputmode="decimal" min="0" placeholder="No limit" [(ngModel)]="limits[c.name]" (change)="save(c.name)" [attr.aria-label]="c.name + ' limit'" />
      </div>
      <div class="empty" *ngIf="!cats.length"><p>No expense categories</p></div>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--k-line); }
    .nm { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .nm i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
    input { width: 120px; min-height: 44px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; text-align: right; }
  `],
})
export class BudgetsComponent implements OnInit {
  private db = inject(DexieService);
  private router = inject(Router);
  cats: { name: string; color: string }[] = [];
  limits: Record<string, number | null> = {};
  loaded = false;

  async ngOnInit() {
    const [cats, buds] = await Promise.all([this.db.getCategoriesByType('expense'), this.db.budgets.toArray()]);
    this.cats = cats;
    buds.forEach(b => (this.limits[b.category] = b.limit));
    this.loaded = true;
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }

  async save(name: string) {
    const v = Number(this.limits[name]);
    const existing = await this.db.budgets.where('category').equals(name).first();
    if (v > 0) existing ? await this.db.budgets.update(existing.id!, { limit: v }) : await this.db.budgets.add({ category: name, limit: v });
    else { this.limits[name] = null; if (existing) await this.db.budgets.delete(existing.id!); }
  }
}
