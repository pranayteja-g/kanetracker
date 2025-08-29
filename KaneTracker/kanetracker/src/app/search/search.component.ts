import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, switchMap } from 'rxjs/operators';

import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchForm!: FormGroup;
  transactions: Transaction[] = [];
  categories: Category[] = [];
  isLoading = false;
  private destroy$ = new Subject<void>();
  showAdvanced = false;

  quickFilters = [
    { label: 'Today', days: 0 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 3 Months', days: 90 },
    { label: 'This Year', days: 365 }
  ];

  sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'amount', label: 'Amount' },
    { value: 'category', label: 'Category' }
  ];

  constructor(
    private fb: FormBuilder,
    private dexieService: DexieService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.loadCategories();
    this.setupFormSubscriptions();
    this.performInitialSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm(): void {
    this.searchForm = this.fb.group({
      query: [''],
      category: [''],
      type: [''],
      startDate: [null as Date | null],
      endDate: [null as Date | null],
      minAmount: [null as number | null],
      maxAmount: [null as number | null],
      sortBy: ['date'],
      sortAsc: [false]
    });
  }

  async loadCategories(): Promise<void> {
    try {
      this.categories = await this.dexieService.getAllCategories();
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  setupFormSubscriptions(): void {
    // Debounced search on text input
    this.searchForm.get('query')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap(() => this.performSearch())
      )
      .subscribe();

    // Instant search on filter changes
    ['category', 'type', 'sortBy', 'sortAsc'].forEach(controlName => {
      this.searchForm.get(controlName)?.valueChanges
        .pipe(
          takeUntil(this.destroy$),
          switchMap(() => this.performSearch())
        )
        .subscribe();
    });

    // Date range changes
    ['startDate', 'endDate', 'minAmount', 'maxAmount'].forEach(controlName => {
      this.searchForm.get(controlName)?.valueChanges
        .pipe(
          debounceTime(500),
          takeUntil(this.destroy$),
          switchMap(() => this.performSearch())
        )
        .subscribe();
    });
  }

  async performInitialSearch(): Promise<void> {
    await this.setQuickFilter(7);
  }

  async performSearch(): Promise<void> {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      const formValue = this.searchForm.value;

      const results = await this.dexieService.searchTransactions(
        formValue.query || '',
        formValue.category || '',
        formValue.type || '',
        formValue.startDate || null,
        formValue.endDate || null,
        formValue.minAmount || null,
        formValue.maxAmount || null,
        formValue.sortBy || 'date',
        formValue.sortAsc || false
      );

      this.transactions = results;
    } catch (error) {
      console.error('Error searching transactions:', error);
      this.transactions = [];
    } finally {
      this.isLoading = false;
    }
  }

  async setQuickFilter(days: number): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();

    if (days === 0) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(endDate.getDate() - days);
    }

    this.searchForm.patchValue({
      startDate: startDate,
      endDate: endDate
    });
  }

  clearFilters(): void {
    this.searchForm.reset({
      query: '',
      category: '',
      type: '',
      startDate: null,
      endDate: null,
      minAmount: null,
      maxAmount: null,
      sortBy: 'date',
      sortAsc: false
    });
  }

  editTransaction(transaction: Transaction): void {
    this.router.navigate(['/transactions/edit', transaction.id]);
  }

  getTransactionIcon(type: string): string {
    return type === 'income' ? 'trending_up' : 'trending_down';
  }

  getTransactionClass(type: string): string {
    return type === 'income' ? 'income-transaction' : 'expense-transaction';
  }

  getCategoryColor(categoryName: string): string {
    const category = this.categories.find(c => c.name === categoryName);
    return category?.color || '#e0e0e0';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  get hasActiveFilters(): boolean {
    const formValue = this.searchForm.value;
    return !!(
      formValue.query ||
      formValue.category ||
      formValue.type ||
      formValue.startDate ||
      formValue.endDate ||
      formValue.minAmount ||
      formValue.maxAmount
    );
  }

  get resultCount(): number {
    return this.transactions.length;
  }
}
