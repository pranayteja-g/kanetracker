import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';
import { CategoryDialogComponent } from '../category-dialog/category-dialog.component';

@Component({
  selector: 'app-categorymanagement',
  standalone: true,
  imports: [NgFor, NgIf, MatIconModule, MatDialogModule],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Categories</h1>
        <button class="icon-btn" (click)="open()" aria-label="Add category"><mat-icon>add</mat-icon></button>
      </header>

      <div class="chips">
        <button class="chip" [class.on]="tab === 'expense'" (click)="tab = 'expense'">Expense</button>
        <button class="chip" [class.on]="tab === 'income'" (click)="tab = 'income'">Income</button>
      </div>

      <div class="list">
        <div class="row" *ngFor="let c of shown; trackBy: byId">
          <button class="main" (click)="open(c)">
            <i [style.background]="c.color"></i>
            <span class="m"><b>{{ c.name }}</b><span>{{ used(c) }} transaction{{ used(c) === 1 ? '' : 's' }}</span></span>
          </button>
          <button class="icon-btn" (click)="remove(c)" [disabled]="used(c) > 0"
            [attr.aria-label]="'Delete ' + c.name" [title]="used(c) ? 'In use' : 'Delete'"><mat-icon>delete_outline</mat-icon></button>
        </div>
      </div>

      <div class="empty" *ngIf="!shown.length">
        <mat-icon>label_outline</mat-icon>
        <p>No {{ tab }} categories</p>
        <button class="btn" (click)="open()">Add category</button>
      </div>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; }
    .top h1 { flex: 1; }
    .list { margin-top: 12px; }
    .row { display: flex; align-items: center; border-bottom: 1px solid var(--k-line); }
    .row:last-child { border-bottom: 0; }
    .main { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 0; border: 0; background: none; text-align: left; min-width: 0; }
    .main i { width: 14px; height: 14px; border-radius: 50%; flex: none; }
    .m { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .m b { font-weight: 500; }
    .m span { font-size: 13px; color: var(--k-muted); }
    .icon-btn:disabled { opacity: .25; cursor: default; }
  `],
})
export class CategorymanagementComponent implements OnInit {
  tab: 'expense' | 'income' = 'expense';
  loaded = false;
  private cats: Category[] = [];
  private usage: Record<string, number> = {};

  constructor(private db: DexieService, private snack: MatSnackBar, private dialog: MatDialog, private router: Router) {}

  async ngOnInit() {
    await this.load();
    this.loaded = true;
  }

  private async load() {
    const [cats, usage] = await Promise.all([this.db.getAllCategories(), this.db.getCategoryUsageCounts()]);
    this.cats = cats.sort((a, b) => a.name.localeCompare(b.name));
    this.usage = usage;
  }

  get shown() {
    return this.cats.filter(c => c.type === this.tab);
  }

  byId = (_: number, c: Category) => c.id;
  used = (c: Category) => this.usage[c.name] || 0;
  back() { history.length > 1 ? history.back() : this.router.navigate(['/dashboard']); }

  open(category?: Category) {
    this.dialog
      .open(CategoryDialogComponent, { width: '92vw', maxWidth: '420px', data: category ? { category } : { category: { type: this.tab } } })
      .afterClosed()
      .subscribe(r => r?.success && this.load());
  }

  async remove(c: Category) {
    if (!c.id || this.used(c) > 0) return;
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await this.db.deleteCategory(c.id);
      this.snack.open('Deleted', undefined, { duration: 1500 });
      await this.load();
    } catch (e: any) {
      this.snack.open(e?.message || 'Delete failed', 'OK', { duration: 4000 });
    }
  }
}
