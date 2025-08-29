import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';

@Component({
  selector: 'app-transaction-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonToggleModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>{{ isEditMode ? 'Edit Transaction' : 'Transaction Details' }}</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <form [formGroup]="transactionForm" *ngIf="isEditMode; else viewMode">
          <!-- Amount -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Amount</mat-label>
            <input matInput type="number" formControlName="amount" placeholder="Enter amount">
            <mat-error *ngIf="transactionForm.get('amount')?.invalid">
              Amount is required and must be positive
            </mat-error>
          </mat-form-field>

          <!-- Type Toggle -->
          <mat-button-toggle-group formControlName="type" class="full-width" (change)="onTypeChange()">
            <mat-button-toggle value="income">Income</mat-button-toggle>
            <mat-button-toggle value="expense">Expense</mat-button-toggle>
          </mat-button-toggle-group>

          <!-- Category -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option *ngFor="let cat of filteredCategories" [value]="cat.name">
                <span class="color-dot" [style.background]="cat.color"></span> {{ cat.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Date -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Date</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="date">
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>

          <!-- Description -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
          </mat-form-field>
        </form>

        <!-- View Mode Template -->
        <ng-template #viewMode>
          <div class="transaction-details">
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value" [ngClass]="data.transaction.type">
                {{ data.transaction.type === 'income' ? '+' : '-' }}₹{{ data.transaction.amount | number:'1.2-2' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{{ data.transaction.type | titlecase }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">{{ data.transaction.category }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">{{ data.transaction.date | date:'fullDate' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Description:</span>
              <span class="detail-value">{{ data.transaction.description || 'No description' }}</span>
            </div>
          </div>
        </ng-template>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <div class="action-buttons" *ngIf="!isEditMode">
          <button mat-button (click)="toggleEditMode()">
            <mat-icon>edit</mat-icon>
            Edit
          </button>
          <button mat-button color="warn" (click)="deleteTransaction()">
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        </div>
        
        <div class="action-buttons" *ngIf="isEditMode">
          <button mat-button (click)="cancelEdit()">Cancel</button>
          <button mat-raised-button color="primary" (click)="saveTransaction()" [disabled]="transactionForm.invalid">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./transaction-detail-dialog.component.css']
})
export class TransactionDetailDialogComponent implements OnInit {
  transactionForm!: FormGroup;
  isEditMode = false;
  allCategories: Category[] = [];
  filteredCategories: Category[] = [];

  constructor(
    public dialogRef: MatDialogRef<TransactionDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { transaction: Transaction },
    private fb: FormBuilder,
    private dexieService: DexieService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.initializeForm();
    this.allCategories = await this.dexieService.getAllCategories();
    this.filterCategories();
  }

  initializeForm() {
    this.transactionForm = this.fb.group({
      amount: [this.data.transaction.amount, [Validators.required, Validators.min(0.01)]],
      type: [this.data.transaction.type, Validators.required],
      category: [this.data.transaction.category, Validators.required],
      date: [new Date(this.data.transaction.date), Validators.required],
      description: [this.data.transaction.description || '']
    });
  }

  filterCategories() {
    const selectedType = this.transactionForm?.get('type')?.value || this.data.transaction.type;
    this.filteredCategories = this.allCategories.filter(cat => cat.type === selectedType);
  }

  onTypeChange() {
    this.filterCategories();
    this.transactionForm.patchValue({ category: '' }); // Reset category when type changes
  }

  toggleEditMode() {
    this.isEditMode = true;
    this.initializeForm(); // Reset form to original values
  }

  cancelEdit() {
    this.isEditMode = false;
    this.initializeForm(); // Reset form to original values
  }

  async saveTransaction() {
    if (this.transactionForm.valid && this.data.transaction.id) {
      try {
        const updatedTransaction = {
          ...this.transactionForm.value,
          date: this.transactionForm.value.date.toISOString()
        };
        
        await this.dexieService.updateTransaction(this.data.transaction.id, updatedTransaction);
        
        this.snackBar.open('Transaction updated successfully', 'Close', { 
          duration: 2000 
        });
        
        this.dialogRef.close({ updated: true });
      } catch (error) {
        this.snackBar.open('Failed to update transaction', 'Close', { 
          duration: 3000 
        });
      }
    }
  }

  async deleteTransaction() {
    const confirmed = confirm('Are you sure you want to delete this transaction?');
    if (confirmed && this.data.transaction.id) {
      try {
        await this.dexieService.deleteTransaction(this.data.transaction.id);
        this.snackBar.open('Transaction deleted successfully', 'Close', { 
          duration: 2000 
        });
        this.dialogRef.close({ deleted: true });
      } catch (error) {
        this.snackBar.open('Failed to delete transaction', 'Close', { 
          duration: 3000 
        });
      }
    }
  }
}
