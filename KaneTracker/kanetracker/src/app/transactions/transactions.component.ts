import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog/transaction-detail-dialog.component';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatPaginatorModule
  ],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css'],
})
export class TransactionsComponent implements OnInit {
  allTransactions: Transaction[] = [];
  paginatedTransactions: Transaction[] = [];
  categories: Category[] = [];

  // Pagination properties
  pageSize = 20;
  currentPage = 0;
  totalTransactions = 0;
  pageSizeOptions = [10, 20, 50, 100];

  constructor(
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) { }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.allTransactions = await this.dexieService.getAllTransactions();
    this.categories = await this.dexieService.getAllCategories();

    // Sort transactions by date (latest first)
    this.allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    this.totalTransactions = this.allTransactions.length;
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedTransactions = this.allTransactions.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.updatePaginatedData();

    // Scroll to top after page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Fixed method for page size change with proper type casting
  onPageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.pageSize = +target.value;
      this.currentPage = 0;
      this.updatePaginatedData();
    }
  }

  navigateToSearch() {
    this.router.navigate(['/search']);
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

  getTotalIncome(): number {
    return this.allTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  getTotalExpenses(): number {
    return this.allTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  getNetBalance(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  // Custom pagination display methods
  get currentPageNumber(): number {
    return this.currentPage + 1;
  }

  get totalPages(): number {
    return Math.ceil(this.totalTransactions / this.pageSize);
  }

  get startIndex(): number {
    return this.currentPage * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalTransactions);
  }
}
