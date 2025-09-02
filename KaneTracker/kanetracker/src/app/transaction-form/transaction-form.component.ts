import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { Subject, debounceTime, takeUntil } from 'rxjs';

import { CategoryDialogComponent } from '../category-dialog/category-dialog.component';
import { Category } from '../models/category.interface';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';

// Custom Validators
export class CustomValidators {
  static futureDate(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    const today = new Date();
    const inputDate = new Date(control.value);
    const maxFutureDate = new Date();
    maxFutureDate.setDate(today.getDate() + 7);

    if (inputDate > maxFutureDate) {
      return { 'futureDate': { value: control.value } };
    }
    return null;
  }

  static reasonableAmount(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    const amount = Number(control.value);
    const maxAmount = 10000000;

    if (amount > maxAmount) {
      return { 'unreasonableAmount': { value: control.value, max: maxAmount } };
    }
    return null;
  }

  static noWhitespace(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    const isWhitespace = (control.value || '').trim().length === 0;
    return isWhitespace ? { 'whitespace': true } : null;
  }
}

interface FormErrors {
  [key: string]: string[];
}

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent implements OnInit, AfterViewInit, OnDestroy {
  transactionForm!: FormGroup;
  categories: Category[] = [];
  selectedType: 'income' | 'expense' = 'expense';
  isLoadingCategories = false;
  isSubmitting = false;

  private destroy$ = new Subject<void>();
  private readonly LARGE_AMOUNT_THRESHOLD = 100000;

  constructor(
    private fb: FormBuilder,
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    this.initializeForm();
    await this.loadCategories();
    this.setupFormValueChanges();
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.transactionForm = this.fb.group({
      amount: [
        null,
        [
          Validators.required,
          Validators.min(0.01),
          Validators.max(10000000),
          CustomValidators.reasonableAmount
        ]
      ],
      category: ['', Validators.required],
      date: [
        new Date(),
        [
          Validators.required,
          CustomValidators.futureDate
        ]
      ],
      description: [
        '',
        [
          Validators.maxLength(200),
          CustomValidators.noWhitespace
        ]
      ],
      type: ['expense', Validators.required]
    });
  }

  private setupFormValueChanges(): void {
    // Listen for type changes
    this.transactionForm.get('type')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((type: 'income' | 'expense') => {
        this.selectedType = type;
        this.loadCategories();
        this.transactionForm.patchValue({ category: '' }, { emitEvent: false });
      });

    // Debounced amount validation
    this.transactionForm.get('amount')?.valueChanges
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe((amount: number) => {
        if (amount && amount > this.LARGE_AMOUNT_THRESHOLD) {
          this.showNotification('Large amount detected. Please verify the amount is correct.', 'warning');
        }
      });
  }

  async loadCategories(): Promise<void> {
    try {
      this.isLoadingCategories = true;
      const allCategories = await this.dexieService.getAllCategories();
      this.categories = allCategories.filter(cat => cat.type === this.selectedType);

      if (this.categories.length === 0) {
        this.showNotification(`No ${this.selectedType} categories found. Create one to get started!`, 'info');
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.showNotification('Failed to load categories. Please try again.', 'error');
    } finally {
      this.isLoadingCategories = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.transactionForm.invalid) {
      this.markAllFieldsAsTouched();
      this.showValidationErrors();
      return;
    }

    try {
      this.isSubmitting = true;
      const formValue = this.transactionForm.value;

      const transaction: Transaction = {
        amount: Number(formValue.amount),
        category: formValue.category.trim(),
        date: formValue.date.toISOString(),
        description: formValue.description?.trim() || '',
        type: formValue.type
      };

      await this.dexieService.addTransaction(transaction);
      this.showNotification('Transaction saved successfully! 🎉', 'success');

      // Reset form with smart defaults
      this.resetFormWithDefaults(formValue);

      // Navigate back after success
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1500);

    } catch (error: any) {
      console.error('Transaction save error:', error);
      this.showNotification('Failed to save transaction. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async addCategory(): Promise<void> {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '90vw',
      maxWidth: '450px',
      data: { category: { type: this.selectedType } },
      panelClass: 'custom-dialog'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.success) {
        await this.loadCategories();
        await this.selectNewlyCreatedCategory();
      }
    });
  }

  private async selectNewlyCreatedCategory(): Promise<void> {
    try {
      const categories = await this.dexieService.getCategoriesByType(this.selectedType);
      const newCategory = categories[categories.length - 1];

      if (newCategory) {
        this.transactionForm.patchValue({ category: newCategory.name });
        this.showNotification(`Category "${newCategory.name}" created and selected!`, 'success');
      }
    } catch (error) {
      console.error('Error selecting new category:', error);
    }
  }

  private resetFormWithDefaults(previousValues: any): void {
    this.transactionForm.reset({
      date: new Date(),
      type: previousValues.type,
      category: previousValues.category,
      amount: null,
      description: ''
    });
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.transactionForm.controls).forEach(key => {
      this.transactionForm.get(key)?.markAsTouched();
    });
  }

  private showValidationErrors(): void {
    const errors = this.getFormErrors();
    const errorMessages = Object.values(errors).flat();

    if (errorMessages.length > 0) {
      this.showNotification('Please fix the following:\n' + errorMessages.join('\n'), 'error');
    }
  }

  private getFormErrors(): FormErrors {
    const errors: FormErrors = {};

    Object.keys(this.transactionForm.controls).forEach(key => {
      const controlErrors = this.transactionForm.get(key)?.errors;
      if (controlErrors) {
        errors[key] = this.mapControlErrors(key, controlErrors);
      }
    });

    return errors;
  }

  private mapControlErrors(fieldName: string, controlErrors: any): string[] {
    const errorMessages: string[] = [];

    switch (fieldName) {
      case 'amount':
        if (controlErrors.required) errorMessages.push('Amount is required');
        if (controlErrors.min) errorMessages.push('Amount must be greater than ₹0.01');
        if (controlErrors.unreasonableAmount) errorMessages.push('Amount seems too large');
        break;
      case 'category':
        if (controlErrors.required) errorMessages.push('Please select a category');
        break;
      case 'date':
        if (controlErrors.futureDate) errorMessages.push('Date cannot be more than 7 days in the future');
        break;
      case 'description':
        if (controlErrors.maxlength) errorMessages.push('Description is too long (max 200 characters)');
        if (controlErrors.whitespace) errorMessages.push('Description cannot be empty if provided');
        break;
    }

    return errorMessages;
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: type === 'error' ? 5000 : 3000,
      panelClass: [`${type}-snackbar`],
      horizontalPosition: type === 'error' ? 'center' : 'right',
      verticalPosition: type === 'error' ? 'top' : 'bottom'
    });
  }

  // Getters
  get isFormValid(): boolean {
    return this.transactionForm.valid;
  }

  get canSubmit(): boolean {
    return this.isFormValid && !this.isSubmitting && !this.isLoadingCategories;
  }
}