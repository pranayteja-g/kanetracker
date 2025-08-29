import { Component, OnInit } from '@angular/core';
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
    maxFutureDate.setDate(today.getDate() + 7); // Allow up to 7 days in future

    if (inputDate > maxFutureDate) {
      return { 'futureDate': { value: control.value } };
    }
    return null;
  }

  static reasonableAmount(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    const amount = Number(control.value);
    const maxAmount = 10000000; // 1 crore

    if (amount > maxAmount) {
      return { 'unreasonableAmount': { value: control.value, max: maxAmount } };
    }
    return null;
  }

  static noWhitespace(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { 'whitespace': true };
  }
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
    MatIconModule
  ],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent implements OnInit {
  transactionForm!: FormGroup;
  categories: Category[] = [];
  selectedType: 'income' | 'expense' = 'expense';
  isLoading = false;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    this.initializeForm();
    await this.loadCategories();
    this.setupFormValueChanges();
  }

  initializeForm() {
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

  setupFormValueChanges() {
    // Listen for type changes to filter categories
    this.transactionForm.get('type')?.valueChanges.subscribe((type) => {
      this.selectedType = type;
      this.loadCategories();
      this.transactionForm.patchValue({ category: '' });
    });

    // Real-time amount validation feedback
    this.transactionForm.get('amount')?.valueChanges.subscribe((amount) => {
      if (amount && amount > 100000) {
        // Show warning for large amounts (but don't block)
        this.showWarning('Large amount detected. Please verify the amount is correct.');
      }
    });
  }

  async loadCategories() {
    try {
      this.isLoading = true;
      const allCategories = await this.dexieService.getAllCategories();
      const selectedType = this.transactionForm.get('type')?.value || 'expense';
      this.categories = allCategories.filter(cat => cat.type === selectedType);

      if (this.categories.length === 0) {
        this.showInfo(`No ${selectedType} categories found. Create one to get started!`);
      }
    } catch (error) {
      this.showError('Failed to load categories. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async onSubmit() {
    if (this.transactionForm.invalid) {
      this.markAllFieldsAsTouched();
      this.showValidationErrors();
      return;
    }

    try {
      this.isSubmitting = true;

      // Sanitize and prepare transaction data
      const formValue = this.transactionForm.value;
      const transaction: Transaction = {
        amount: Number(formValue.amount),
        category: formValue.category.trim(),
        date: formValue.date.toISOString(),
        description: formValue.description?.trim() || '',
        type: formValue.type
      };

      await this.dexieService.addTransaction(transaction);

      this.showSuccess('Transaction saved successfully! 🎉');

      // Reset form with smart defaults
      this.transactionForm.reset({
        date: new Date(),
        type: formValue.type, // Keep same type
        category: formValue.category // Keep same category
      });

      // Navigate back to dashboard
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1000);

    } catch (error: any) {
      this.showError('Failed to save transaction. Please try again.');
      console.error('Transaction save error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  async addCategory() {
    const selectedType = this.transactionForm.get('type')?.value || 'expense';

    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '90vw',
      maxWidth: '450px',
      data: { category: { type: selectedType } }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.success) {
        await this.loadCategories();

        // Auto-select the newly created category
        try {
          const categories = await this.dexieService.getCategoriesByType(selectedType);
          const newCategory = categories[categories.length - 1];
          if (newCategory) {
            this.transactionForm.patchValue({ category: newCategory.name });
            this.showSuccess(`Category "${newCategory.name}" created and selected!`);
          }
        } catch (error) {
          console.error('Error selecting new category:', error);
        }
      }
    });
  }

  selectType(type: 'income' | 'expense') {
    this.selectedType = type;
    this.transactionForm.patchValue({ type });
  }

  // Helper methods for form validation
  markAllFieldsAsTouched() {
    Object.keys(this.transactionForm.controls).forEach(key => {
      this.transactionForm.get(key)?.markAsTouched();
    });
  }

  showValidationErrors() {
    const errors: string[] = [];

    if (this.transactionForm.get('amount')?.errors) {
      const amountErrors = this.transactionForm.get('amount')?.errors;
      if (amountErrors?.['required']) errors.push('Amount is required');
      if (amountErrors?.['min']) errors.push('Amount must be greater than 0');
      if (amountErrors?.['unreasonableAmount']) errors.push('Amount seems too large. Please verify.');
    }

    if (this.transactionForm.get('category')?.errors) {
      errors.push('Please select a category');
    }

    if (this.transactionForm.get('date')?.errors) {
      const dateErrors = this.transactionForm.get('date')?.errors;
      if (dateErrors?.['futureDate']) errors.push('Date cannot be more than 7 days in the future');
    }

    if (this.transactionForm.get('description')?.errors) {
      const descErrors = this.transactionForm.get('description')?.errors;
      if (descErrors?.['maxlength']) errors.push('Description is too long (max 200 characters)');
      if (descErrors?.['whitespace']) errors.push('Description cannot be empty if provided');
    }

    if (errors.length > 0) {
      this.showError('Please fix the following:\n' + errors.join('\n'));
    }
  }

  // Utility methods for user feedback
  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  showWarning(message: string) {
    this.snackBar.open(message, 'Got it', {
      duration: 4000,
      panelClass: ['warning-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  showInfo(message: string) {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['info-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  // Getter methods for template
  get isFormValid() { return this.transactionForm.valid; }
  get canSubmit() { return this.isFormValid && !this.isSubmitting; }
}
