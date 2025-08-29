import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import { MatDialog } from '@angular/material/dialog';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog/transaction-detail-dialog.component';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css'],
})
export class TransactionsComponent implements OnInit {
  transactions: Transaction[] = [];
  categories: Category[] = [];

  constructor(
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.transactions = await this.dexieService.getAllTransactions();
    this.categories = await this.dexieService.getAllCategories();
  }

  getCategoryColor(categoryName: string): string {
    const category = this.categories.find(c => c.name === categoryName);
    return category?.color || '#e0e0e0';
  }

  hexToRgba(hex: string, opacity: number = 0.15): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // New method to open transaction details
  openTransactionDetails(transaction: Transaction) {
    const dialogRef = this.dialog.open(TransactionDetailDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: { transaction }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.updated || result?.deleted) {
        this.loadData(); // Refresh the transactions list
      }
    });
  }
  async deleteTransaction(id?: number) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this transaction?')) {
      await this.dexieService.deleteTransaction(id);
      this.snackBar.open('Transaction deleted', 'Close', { duration: 2000 });
      await this.loadData();
    }
  }
}
