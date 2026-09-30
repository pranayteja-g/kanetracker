import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CategoryDialogComponent } from '../category-dialog/category-dialog.component';
import { Category } from '../models/category.interface';
import { Transaction } from '../models/transaction.interface';
import { DexieService } from '../services/dexie.service';

type Type = 'income' | 'expense';

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [NgFor, ReactiveFormsModule, MatIconModule],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css'],
})
export class TransactionFormComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private db = inject(DexieService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  @ViewChild('amount') amountEl?: ElementRef<HTMLInputElement>;

  form = this.fb.nonNullable.group({
    type: 'expense' as Type,
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(10_000_000)]],
    category: ['', Validators.required],
    date: [toInput(new Date()), Validators.required],
    description: ['', Validators.maxLength(200)],
  });

  maxDate = toInput(new Date(Date.now() + 7 * 864e5));
  categories: Category[] = [];
  saving = false;
  private allCats: Category[] = [];

  get type(): Type {
    return this.form.controls.type.value;
  }

  get canSave() {
    return this.form.valid && !this.saving;
  }

  async ngOnInit() {
    this.allCats = await this.db.getAllCategories();
    this.filterCats();
  }

  ngAfterViewInit() {
    setTimeout(() => this.amountEl?.nativeElement.focus(), 150);
  }

  setType(t: Type) {
    if (t === this.type) return;
    this.form.patchValue({ type: t, category: '' });
    this.filterCats();
  }

  pick(name: string) {
    this.form.controls.category.setValue(name);
  }

  addCategory() {
    this.dialog
      .open(CategoryDialogComponent, { width: '90vw', maxWidth: '450px', data: { category: { type: this.type } } })
      .afterClosed()
      .subscribe(async r => {
        if (!r?.success) return;
        this.allCats = await this.db.getAllCategories();
        this.filterCats();
        const created = this.categories[this.categories.length - 1];
        if (created) this.pick(created.name);
      });
  }

  async save() {
    if (!this.canSave) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      const [y, m, d] = v.date.split('-').map(Number);
      const tx: Transaction = {
        type: v.type,
        amount: Number(v.amount),
        category: v.category.trim(),
        date: new Date(y, m - 1, d).toISOString(),
        description: v.description.trim(),
      };
      await this.db.addTransaction(tx);
      this.snack.open('Saved', undefined, { duration: 1500 });
      this.router.navigate(['/dashboard']);
    } catch {
      this.snack.open('Save failed. Try again.', 'OK', { duration: 4000 });
      this.saving = false;
    }
  }

  close() {
    history.length > 1 ? history.back() : this.router.navigate(['/dashboard']);
  }

  private filterCats() {
    this.categories = this.allCats.filter(c => c.type === this.type);
  }
}
