import { Component, Inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';

const HEX = /^#[0-9a-f]{6}$/i;

@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MatDialogModule, MatIconModule],
  template: `
    <div class="dlg">
      <header>
        <h2 mat-dialog-title>{{ editing ? 'Edit category' : 'New category' }}</h2>
        <button class="icon-btn" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
      </header>

      <input class="name" [(ngModel)]="name" maxlength="30" placeholder="Name" aria-label="Name" (keyup.enter)="save()" />

      <div class="seg" *ngIf="!editing">
        <button type="button" [class.on]="type === 'expense'" (click)="type = 'expense'">Expense</button>
        <button type="button" [class.on]="type === 'income'" (click)="type = 'income'">Income</button>
      </div>

      <p class="label">Color</p>
      <div class="colors">
        <button type="button" *ngFor="let c of palette" [style.background]="c" [class.on]="c === color"
          (click)="color = c" [attr.aria-label]="c"></button>
      </div>

      <p class="err" *ngIf="error">{{ error }}</p>
      <button class="btn save" (click)="save()" [disabled]="!valid || saving">{{ editing ? 'Save' : 'Create' }}</button>
    </div>
  `,
  styles: [`
    .dlg { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    header { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; font-size: 18px; font-weight: 600; padding: 0; }
    h2::before { display: none; }
    .name { min-height: 48px; padding: 0 14px; border: 1px solid var(--k-line); border-radius: 12px; font: inherit; font-size: 16px; }
    .seg { display: flex; padding: 3px; border-radius: 999px; background: var(--k-line); }
    .seg button { flex: 1; border: 0; background: none; padding: 8px; border-radius: 999px; font-size: 14px; color: var(--k-muted); }
    .seg button.on { background: #fff; color: var(--k-ink); font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .label { margin: 0; }
    .colors { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; justify-items: center; }
    .colors button { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--k-line); }
    .colors button.on { box-shadow: 0 0 0 2px var(--k-ink); }
    .err { margin: 0; color: #b91c1c; font-size: 13px; }
    .save { width: 100%; }
  `],
})
export class CategoryDialogComponent {
  palette = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#a3a3a3', '#171717'];

  editing: boolean;
  name: string;
  type: 'income' | 'expense';
  color: string;
  error = '';
  saving = false;

  constructor(
    private ref: MatDialogRef<CategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: { category?: Partial<Category> },
    private db: DexieService,
    private snack: MatSnackBar
  ) {
    const c = data?.category;
    this.editing = !!c?.id;                 // a bare {type} means "create", not edit
    this.name = c?.name || '';
    this.type = c?.type || 'expense';
    this.color = c?.color && HEX.test(c.color) ? c.color : this.palette[8];
  }

  get valid() {
    return this.name.trim().length > 0 && HEX.test(this.color);
  }

  async save() {
    if (!this.valid || this.saving) return;
    this.saving = true;
    this.error = '';
    const value = { name: this.name.trim(), type: this.type, color: this.color };
    try {
      if (this.editing) await this.db.updateCategory(this.data.category!.id!, value);
      else await this.db.addCategory(value);
      this.snack.open('Saved', undefined, { duration: 1500 });
      this.ref.close({ success: true });
    } catch (e: any) {
      this.error = e?.message || 'Could not save';
      this.saving = false;
    }
  }
}
