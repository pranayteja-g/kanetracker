import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';
@Component({
  selector: 'app-categorymanagement',
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatDialogModule],
  template: `
    <div class="categories-container">
      <h1>Manage Categories</h1>
      
      <div class="categories-section">
        <h2>Income Categories</h2>
        <div class="categories-list" *ngIf="incomeCategories.length > 0; else noIncomeCategories">
          <div *ngFor="let category of incomeCategories" class="category-card">
            <div class="category-info">
              <div class="category-dot" [style.background]="category.color"></div>
              <span class="category-name">{{ category.name }}</span>
              <span class="usage-count">({{ getCategoryUsage(category.name) }} transactions)</span>
            </div>
            <button mat-icon-button color="warn" (click)="deleteCategory(category)" 
                    [disabled]="getCategoryUsage(category.name) > 0">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        <ng-template #noIncomeCategories>
          <p class="no-categories">No income categories yet</p>
        </ng-template>
      </div>

      <div class="categories-section">
        <h2>Expense Categories</h2>
        <div class="categories-list" *ngIf="expenseCategories.length > 0; else noExpenseCategories">
          <div *ngFor="let category of expenseCategories" class="category-card">
            <div class="category-info">
              <div class="category-dot" [style.background]="category.color"></div>
              <span class="category-name">{{ category.name }}</span>
              <span class="usage-count">({{ getCategoryUsage(category.name) }} transactions)</span>
            </div>
            <button mat-icon-button color="warn" (click)="deleteCategory(category)"
                    [disabled]="getCategoryUsage(category.name) > 0">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        <ng-template #noExpenseCategories>
          <p class="no-categories">No expense categories yet</p>
        </ng-template>
      </div>
    </div>
  `,
  styleUrl: './categorymanagement.component.css'
})
export class CategorymanagementComponent implements OnInit {
  incomeCategories: Category[] = [];
  expenseCategories: Category[] = [];
  categoryUsage: { [categoryName: string]: number } = {};

  constructor(
    private dexieService: DexieService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    await this.loadCategories();
  }

  async loadCategories() {
    const allCategories = await this.dexieService.getAllCategories();
    this.incomeCategories = allCategories.filter(c => c.type === 'income');
    this.expenseCategories = allCategories.filter(c => c.type === 'expense');

    // Load usage counts
    for (const category of allCategories) {
      this.categoryUsage[category.name] = await this.dexieService.getCategoryUsageCount(category.name);
    }
  }

  getCategoryUsage(categoryName: string): number {
    return this.categoryUsage[categoryName] || 0;
  }

  async deleteCategory(category: Category) {
    const usageCount = this.getCategoryUsage(category.name);

    if (usageCount > 0) {
      this.snackBar.open(
        `Cannot delete "${category.name}" - it's used in ${usageCount} transaction(s)`,
        'Close',
        { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' }
      );
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete the category "${category.name}"?`);
    if (confirmed && category.id) {
      try {
        await this.dexieService.deleteCategory(category.id);
        this.snackBar.open(`Category "${category.name}" deleted successfully`, 'Close', {
          duration: 2000
        });
        await this.loadCategories(); // Refresh the list
      } catch (error: any) {
        this.snackBar.open(error.message || 'Failed to delete category', 'Close', {
          duration: 4000
        });
      }
    }
  }
}