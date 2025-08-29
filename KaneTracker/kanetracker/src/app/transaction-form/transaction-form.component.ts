import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router'; // Add Router import
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { Category } from '../models/category.interface';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { CategoryDialogComponent } from '../category-dialog/category-dialog.component';

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
    MatDividerModule
  ],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent implements OnInit {
  transactionForm!: FormGroup;
  categories: Category[] = [];
  selectedType: 'income' | 'expense' = 'expense';

  constructor(
    private fb: FormBuilder,
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    this.transactionForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      category: ['', Validators.required],
      date: [new Date()],
      description: [''],
      type: ['expense']
    });

    // Load categories and filter by type when type changes
    await this.loadCategories();

    // Listen for type changes to filter categories
    this.transactionForm.get('type')?.valueChanges.subscribe(() => {
      this.loadCategories();
      this.transactionForm.patchValue({ category: '' }); // Reset category selection
    });
  }

  async loadCategories() {
    const allCategories = await this.dexieService.getAllCategories();
    const selectedType = this.transactionForm.get('type')?.value || 'expense';

    // Filter categories by type
    this.categories = allCategories.filter(cat => cat.type === selectedType);
  }

  async onSubmit() {
    if (this.transactionForm.valid) {
      const transaction: Transaction = this.transactionForm.value;
      await this.dexieService.addTransaction(transaction);

      // Show confirmation
      this.snackBar.open('Transaction logged successfully ✅', 'Close', {
        duration: 2000, // Reduced duration since we're redirecting
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });

      // Redirect to dashboard after brief delay
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1500);
    }
  }

  // Replace the existing addCategory method with this:

  addCategory() {
    const selectedType = this.transactionForm.get('type')?.value || 'expense';

    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '90vw',
      maxWidth: '450px',
      data: { category: { type: selectedType } }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.success) {
        await this.loadCategories();
        // Auto-select the newly created category if possible
        const categories = await this.dexieService.getCategoriesByType(selectedType);
        const newCategory = categories[categories.length - 1];
        if (newCategory) {
          this.transactionForm.patchValue({ category: newCategory.name });
        }
      }
    });
  }

  selectType(type: 'income' | 'expense') {
    this.selectedType = type;
    this.transactionForm.patchValue({ type });
  }
}
