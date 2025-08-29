import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';

@Injectable({
  providedIn: 'root'
})
export class DexieService extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;

  constructor() {
    super('KaneTrackerDB');
    this.version(2).stores({
      transactions: '++id, amount, category, date, description, type',
      categories: '++id, name, color, type'
    }).upgrade(tx => {
      return tx.table('categories').toCollection().modify((category: Category) => {
        if (!category.type) {
          category.type = 'expense';
        }
      });
    });

    // Initialize tables
    this.transactions = this.table('transactions');
    this.categories = this.table('categories');
  }

  async addTransaction(transaction: Transaction): Promise<number> {
    try {
      if (!transaction.amount || transaction.amount <= 0) {
        throw new Error('Invalid transaction amount');
      }
      if (!transaction.category?.trim()) {
        throw new Error('Transaction category is required');
      }
      return await this.transactions.add(transaction);
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw new Error('Failed to save transaction. Please try again.');
    }
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

  async addCategory(category: Category): Promise<number> {
    try {
      if (!category.name?.trim()) {
        throw new Error('Category name is required');
      }

      const existingCategories = await this.getCategoriesByType(category.type);
      const isDuplicate = existingCategories.some(
        cat => cat.name.toLowerCase().trim() === category.name.toLowerCase().trim()
      );

      if (isDuplicate) {
        throw new Error(`A ${category.type} category named "${category.name}" already exists`);
      }

      return await this.categories.add(category);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  getCategoriesByType(type: 'income' | 'expense'): Promise<Category[]> {
    return this.categories.where('type').equals(type).toArray();
  }

  async deleteCategory(categoryId: number): Promise<boolean> {
    const categoryToDelete = await this.categories.get(categoryId);
    if (!categoryToDelete) return false;

    const transactionsUsingCategory = await this.transactions
      .where('category')
      .equals(categoryToDelete.name)
      .count();

    if (transactionsUsingCategory > 0) {
      throw new Error(`Cannot delete category "${categoryToDelete.name}" because it's used in ${transactionsUsingCategory} transaction(s).`);
    }

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

  // Fixed search method with proper TypeScript typing
  async searchTransactions(
    query: string = '',
    category: string = '',
    type: 'income' | 'expense' | '' = '',
    startDate: Date | null = null,
    endDate: Date | null = null,
    minAmount: number | null = null,
    maxAmount: number | null = null,
    sortBy: 'date' | 'amount' | 'category' = 'date',
    sortAsc: boolean = false
  ): Promise<Transaction[]> {
    try {
      let collection = this.transactions.toCollection(); // Fixed: use this.transactions instead of this.db.transactions

      // Text search in description - Fixed typing
      if (query) {
        const lowerQuery = query.toLowerCase();
        collection = collection.filter((t: Transaction) =>
          t.description.toLowerCase().includes(lowerQuery)
        );
      }

      // Category filter - Fixed typing
      if (category) {
        collection = collection.filter((t: Transaction) => t.category === category);
      }

      // Transaction type filter - Fixed typing
      if (type) {
        collection = collection.filter((t: Transaction) => t.type === type);
      }

      // Date range filters - Fixed typing
      if (startDate) {
        collection = collection.filter((t: Transaction) => new Date(t.date) >= startDate);
      }

      if (endDate) {
        collection = collection.filter((t: Transaction) => new Date(t.date) <= endDate);
      }

      // Amount range filters - Fixed typing
      if (minAmount !== null) {
        collection = collection.filter((t: Transaction) => t.amount >= minAmount);
      }

      if (maxAmount !== null) {
        collection = collection.filter((t: Transaction) => t.amount <= maxAmount);
      }

      // Execute query and get results
      let results = await collection.toArray();

      // Sort results - Fixed typing
      results = results.sort((a: Transaction, b: Transaction) => {
        let cmp = 0;
        switch (sortBy) {
          case 'date':
            cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
            break;
          case 'amount':
            cmp = b.amount - a.amount;
            break;
          case 'category':
            cmp = a.category.localeCompare(b.category);
            break;
        }
        return sortAsc ? -cmp : cmp;
      });

      return results;
    } catch (error) {
      console.error('Error searching transactions:', error);
      return [];
    }
  }

  // Quick filter methods for common use cases
  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.searchTransactions('', '', '', startDate, endDate);
  }

  async getTransactionsByCategory(category: string): Promise<Transaction[]> {
    return this.searchTransactions('', category);
  }

  async getTransactionsByType(type: 'income' | 'expense'): Promise<Transaction[]> {
    return this.searchTransactions('', '', type);
  }

  async getRecentTransactions(days: number = 7): Promise<Transaction[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    return this.getTransactionsByDateRange(startDate, endDate);
  }
}
