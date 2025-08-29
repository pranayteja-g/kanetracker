import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { Category } from '../models/category.interface';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';

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
  ],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent implements OnInit {
  transactionForm!: FormGroup;
  categories: Category[] = [];
  selectedType: 'income' | 'expense' = 'expense'; // default

  constructor(
    private fb: FormBuilder, 
    private dexieService: DexieService,
    private snackBar: MatSnackBar  
  
  ) { }

  async ngOnInit() {
    this.transactionForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      category: ['', Validators.required],
      date: [new Date()], // default to today
      description: [''],
      type: ['expense'] // default
    });

    this.categories = await this.dexieService.categories.toArray();
  }

  async onSubmit() {
    if (this.transactionForm.valid) {
      const transaction: Transaction = this.transactionForm.value;
      await this.dexieService.addTransaction(transaction);

      // show confirmation
      this.snackBar.open('Transaction logged successfully ✅', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });

      this.transactionForm.reset({ date: new Date(), type: 'expense' });
    }
  }

  async addCategory() {
    const name = prompt('Enter new category name:');
    if (name) {
      const color = '#' + Math.floor(Math.random() * 16777215).toString(16); // random color
      const id = await this.dexieService.categories.add({ name, color });
      this.categories = await this.dexieService.categories.toArray();
      this.transactionForm.patchValue({ category: name });
    }
  }

  selectType(type: 'income' | 'expense') {
    this.selectedType = type;
    this.transactionForm.patchValue({ type });
  }
}
