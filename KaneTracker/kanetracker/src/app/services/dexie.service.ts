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
    this.version(1).stores({
      transactions: '++id, amount, category, date, description, type',
      categories: '++id, name, color'
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
}
