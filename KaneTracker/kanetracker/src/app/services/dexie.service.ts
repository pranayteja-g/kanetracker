import { Injectable } from '@angular/core';
import Dexie from 'dexie';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';

@Injectable({
  providedIn: 'root'
})
export class DexieService extends Dexie {
  transactions: Dexie.Table<Transaction, number>;
  categories!: Dexie.Table<Category, number>;

  constructor() {
    super('KaneTrackerDB');
    this.version(2).stores({ // Increment version for schema change
      transactions: '++id, amount, category, date, description, type',
      categories: '++id, name, color, type' // Add type to schema
    }).upgrade(tx => {
      // Migration: add type field to existing categories
      return tx.table('categories').toCollection().modify(category => {
        if (!category.type) {
          category.type = 'expense'; // Default existing categories to expense
        }
      });
    });

    this.transactions = this.table('transactions');
    this.categories = this.table('categories');
  }

  addTransaction(transaction: Transaction): Promise<number> {
    return this.transactions.add(transaction);
  }

  getAllTransactions(): Promise<Transaction[]> {
    return this.transactions.toArray();
  }

  updateTransaction(id: number, transaction: Partial<Transaction>): Promise<number> {
    return this.transactions.update(id, transaction);
  }

  deleteTransaction(id: number): Promise<void> {
    return this.transactions.delete(id);
  }

  getAllCategories(): Promise<Category[]> {
    return this.categories.toArray();
  }

  addCategory(category: Category): Promise<number> {
    return this.categories.add(category);
  }

  getCategoriesByType(type: 'income' | 'expense'): Promise<Category[]> {
    return this.categories.where('type').equals(type).toArray();
  }

  async deleteCategory(categoryId: number): Promise<boolean> {
    // Check if category is being used in any transactions
    const categoryToDelete = await this.categories.get(categoryId);
    if (!categoryToDelete) return false;

    const transactionsUsingCategory = await this.transactions
      .where('category')
      .equals(categoryToDelete.name)
      .count();

    if (transactionsUsingCategory > 0) {
      throw new Error(`Cannot delete category "${categoryToDelete.name}" because it's used in ${transactionsUsingCategory} transaction(s).`);
    }

    // Safe to delete
    await this.categories.delete(categoryId);
    return true;
  }

  async getCategoryUsageCount(categoryName: string): Promise<number> {
    return await this.transactions
      .where('category')
      .equals(categoryName)
      .count();
  }

  async updateCategory(categoryId: number, categoryData: Partial<Category>): Promise<number> {
    return this.categories.update(categoryId, categoryData);
  }

}
