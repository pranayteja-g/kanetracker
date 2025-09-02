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
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
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
  totalIncome = 0;
  totalExpenses = 0;
  netAmount = 0;

  quickFilters = [
    { label: 'Today', days: 0, icon: 'today' },
    { label: 'Last 7 Days', days: 7, icon: 'date_range' },
    { label: 'Last Month', days: -1, icon: 'calendar_month' },
    { label: 'Last 3 Months', days: 90, icon: 'event_note' },
    { label: 'This Year', days: 365, icon: 'calendar_view_year' }
  ];

  sortOptions = [
    { value: 'date', label: 'Date', icon: 'schedule' },
    { value: 'amount', label: 'Amount', icon: 'currency_rupee' },
    { value: 'category', label: 'Category', icon: 'category' }
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
    this.searchForm.get('query')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.performSearch());

    ['category', 'type', 'sortBy', 'sortAsc'].forEach(controlName => {
      this.searchForm.get(controlName)?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => setTimeout(() => this.performSearch(), 0));
    });

    ['startDate', 'endDate', 'minAmount', 'maxAmount'].forEach(controlName => {
      this.searchForm.get(controlName)?.valueChanges
        .pipe(
          debounceTime(500),
          takeUntil(this.destroy$)
        )
        .subscribe(() => this.performSearch());
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
      this.calculateTotals();
    } catch (error) {
      console.error('Error searching transactions:', error);
      this.transactions = [];
      this.resetTotals();
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
    } else if (days === -1) {
      const now = new Date();
      startDate.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setFullYear(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(endDate.getDate() - days);
    }

    this.searchForm.patchValue({
      startDate: startDate,
      endDate: endDate
    });
  }

  isFilterActive(days: number): boolean {
    const formValue = this.searchForm.value;
    if (!formValue.startDate || !formValue.endDate) return false;

    const currentStart = new Date(formValue.startDate);
    const currentEnd = new Date(formValue.endDate);
    const now = new Date();

    if (days === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return currentStart.toDateString() === today.toDateString();
    } else if (days === -1) {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return currentStart.toDateString() === lastMonthStart.toDateString();
    } else {
      const expectedStart = new Date();
      expectedStart.setDate(now.getDate() - days);
      return Math.abs(currentStart.getTime() - expectedStart.getTime()) < 24 * 60 * 60 * 1000;
    }
  }

  toggleSortDirection(): void {
    const currentValue = this.searchForm.get('sortAsc')?.value;
    this.searchForm.patchValue({ sortAsc: !currentValue });
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

  private calculateTotals(): void {
    this.totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalExpenses = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    this.netAmount = this.totalIncome - this.totalExpenses;
  }

  private resetTotals(): void {
    this.totalIncome = 0;
    this.totalExpenses = 0;
    this.netAmount = 0;
  }

  editTransaction(transaction: Transaction): void {
    this.router.navigate(['/transactions/edit', transaction.id]);
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
