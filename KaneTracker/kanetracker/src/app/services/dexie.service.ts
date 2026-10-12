import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import { Recurring } from '../models/recurring.interface';
import { advance } from '../shared/utils';
import { Budget } from '../models/budget.interface';
import { getBase, guessCurrency, isKnown, setBase } from '../shared/currency';

/** Never exported/imported: lock secrets. */
const round2 = (n: number) => Math.round(n * 100) / 100;
const sig = (n: number) => Number(n.toPrecision(6));
const SECRET_KEYS = new Set(['pinHash', 'pinSalt', 'bioId', 'lockEnabled']);
export const DEFAULT_RATES: Record<string, number> = { USD: 88, EUR: 102, GBP: 118, AED: 24, SGD: 68, JPY: 0.6 };
export const DEFAULT_ACCOUNTS = ['Cash', 'UPI', 'Card'];

export { advance };

@Injectable({
  providedIn: 'root'
})
export class DexieService extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  recurring!: Table<Recurring, number>;
  budgets!: Table<Budget, number>;
  settings!: Table<{ key: string; value: any }, string>;
  /** Set at startup by APP_INITIALIZER. */
  recurringAdded = 0;
  currencyGuessed = false;

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

    // v3: index only what is queried (date/type/category); drop amount/description/color indexes
    this.version(3).stores({
      transactions: '++id, date, type, category, [type+date]',
      categories: '++id, name, type'
    });

    // v4: accounts index, recurring rules, budgets, key/value settings
    this.version(4).stores({
      transactions: '++id, date, type, category, account, [type+date]',
      categories: '++id, name, type',
      recurring: '++id, nextDate',
      budgets: '++id, &category',
      settings: 'key'
    });

    // Initialize tables
    this.transactions = this.table('transactions');
    this.categories = this.table('categories');
    this.recurring = this.table('recurring');
    this.budgets = this.table('budgets');
    this.settings = this.table('settings');
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

  /** Newest first, sorted by the date index (no client-side sort). */
  getTransactionsNewestFirst(): Promise<Transaction[]> {
    return this.transactions.orderBy('date').reverse().toArray();
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

    const rules = await this.recurring.filter(r => r.category === categoryToDelete.name && r.type === categoryToDelete.type).count();
    if (rules > 0) {
      throw new Error(`Cannot delete category "${categoryToDelete.name}" because ${rules} recurring rule(s) use it.`);
    }

    await this.transaction('rw', this.categories, this.budgets, async () => {
      await this.budgets.where('category').equals(categoryToDelete.name).delete();
      await this.categories.delete(categoryId);
    });
    return true;
  }

  async getCategoryUsageCount(categoryName: string): Promise<number> {
    return await this.transactions
      .where('category')
      .equals(categoryName)
      .count();
  }

  /** One pass over transactions: { categoryName: count }. */
  async getCategoryUsageCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await this.transactions.each(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }

  /** Updates a category; a rename also renames it on existing transactions (no orphans). */
  async updateCategory(categoryId: number, categoryData: Partial<Category>): Promise<number> {
    return this.transaction('rw', [this.categories, this.transactions, this.recurring, this.budgets], async () => {
      const current = await this.categories.get(categoryId);
      if (!current) return 0;
      const name = categoryData.name?.trim();
      if (name && name.toLowerCase() !== current.name.toLowerCase()) {
        const same = await this.getCategoriesByType(current.type);
        if (same.some(c => c.id !== categoryId && c.name.toLowerCase().trim() === name.toLowerCase())) {
          throw new Error(`A ${current.type} category named "${name}" already exists`);
        }
      }
      if (name && name !== current.name) {
        await this.transactions.where('category').equals(current.name).modify({ category: name });
        await this.recurring.filter(r => r.category === current.name && r.type === current.type).modify({ category: name });
        if (current.type === 'expense') await this.budgets.where('category').equals(current.name).modify({ category: name });
      }
      return this.categories.update(categoryId, { ...categoryData, ...(name ? { name } : {}), type: current.type });
    });
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
        const endMs = new Date(endDate).setHours(23, 59, 59, 999); // include the whole end day
        collection = collection.filter((t: Transaction) => new Date(t.date).getTime() <= endMs);
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

  // ---------- settings ----------
  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const r = await this.settings.get(key);
    return r ? (r.value as T) : fallback;
  }

  setSetting(key: string, value: any) {
    return this.settings.put({ key, value });
  }

  // ---------- undo / duplicate ----------
  restoreTransaction(t: Transaction) {
    return this.transactions.put(t);
  }

  async duplicateTransaction(t: Transaction): Promise<Transaction> {
    const { id, recurringId, ...rest } = t;
    const now = new Date();
    const copy: Transaction = { ...rest, date: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() };
    copy.id = await this.transactions.add(copy);
    return copy;
  }

  // ---------- form hints: frequent categories + amount presets ----------
  async getFormHints(type: 'income' | 'expense'): Promise<{ cats: string[]; amounts: Record<string, number[]> }> {
    const recent = await this.transactions.orderBy('date').reverse().filter(t => t.type === type).limit(300).toArray();
    const count = new Map<string, number>();
    const amt = new Map<string, Map<number, number>>();
    for (const t of recent) {
      count.set(t.category, (count.get(t.category) || 0) + 1);
      if (t.currency) continue;
      let m = amt.get(t.category);
      if (!m) amt.set(t.category, (m = new Map()));
      m.set(t.amount, (m.get(t.amount) || 0) + 1);
    }
    const order = new Map([...count.keys()].map((k, i) => [k, i])); // first seen = most recent
    const cats = [...count.entries()].sort((a, b) => b[1] - a[1] || order.get(a[0])! - order.get(b[0])!).map(e => e[0]);
    const amounts: Record<string, number[]> = {};
    amt.forEach((m, k) => (amounts[k] = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0])));
    return { cats, amounts };
  }

  // ---------- recurring ----------
  /** Creates every due occurrence up to today; returns how many were created. */
  async processRecurring(now = new Date()): Promise<number> {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return this.transaction('rw', this.transactions, this.recurring, async () => {
      const rules = await this.recurring.where('nextDate').belowOrEqual(new Date(end).toISOString()).filter(r => r.active).toArray();
      let created = 0;
      for (const r of rules) {
        let next = new Date(r.nextDate);
        const stop = r.endDate ? new Date(r.endDate).getTime() : Infinity;
        const batch: Transaction[] = [];
        for (let n = 0; next.getTime() <= end && next.getTime() <= stop && n < 400; n++) {
          batch.push({
            type: r.type, amount: r.amount, category: r.category, description: r.description,
            account: r.account, tags: r.tags, date: next.toISOString(), recurringId: r.id,
          });
          next = advance(next, r.freq, r.dom);
        }
        if (batch.length) await this.transactions.bulkAdd(batch);
        created += batch.length;
        await this.recurring.update(r.id!, { nextDate: next.toISOString(), active: next.getTime() <= stop });
      }
      return created;
    });
  }

  // ---------- base currency ----------
  /** Reads the saved base currency into the shared module. Empty new installs get a locale-based default. */
  async loadBase(): Promise<{ code: string; guessed: boolean }> {
    let code = await this.getSetting<string>('baseCurrency', '');
    let guessed = false;
    if (!code) {
      const hasData = (await this.transactions.count()) > 0;
      code = hasData ? 'INR' : guessCurrency();
      guessed = !hasData && code !== 'INR';
      await this.setSetting('baseCurrency', code);
    }
    setBase(isKnown(code) || /^[A-Z]{3}$/.test(code) ? code : 'INR');
    return { code: getBase(), guessed };
  }

  /** Rates are "base units per 1 foreign unit". Only INR has built-in guesses. */
  async getRates(): Promise<Record<string, number>> {
    const stored = await this.getSetting<Record<string, number> | null>('rates', null);
    if (stored) return stored;
    return getBase() === 'INR' ? { ...DEFAULT_RATES } : {};
  }

  /**
   * Switch base currency.
   *  convert=true  → every stored amount is multiplied by `rate` (1 old = `rate` new). The original
   *                  amount + currency is kept on each entry, so converting back restores it exactly.
   *  convert=false → only the label changes; numbers stay (use when amounts were already in the new currency).
   */
  async changeBaseCurrency(newCode: string, rate: number, convert: boolean): Promise<{ converted: number }> {
    const oldCode = getBase();
    if (newCode === oldCode) return { converted: 0 };
    if (!/^[A-Z]{3}$/.test(newCode)) throw new Error('Bad currency code');
    if (convert && !(rate > 0 && isFinite(rate))) throw new Error('Bad rate');

    let converted = 0;
    await this.transaction('rw', [this.transactions, this.recurring, this.budgets, this.settings], async () => {
      const rates = await this.getRates();
      let nextRates: Record<string, number> = {};

      if (convert) {
        await this.transactions.toCollection().modify((t: Transaction) => {
          converted++;
          if (t.currency === newCode && t.origAmount) {
            // entry was originally in the new base: restore exactly
            t.amount = t.origAmount;
            delete t.currency; delete t.origAmount; delete t.rate;
          } else if (t.currency && t.origAmount) {
            t.amount = round2(t.amount * rate);
            t.rate = sig(t.amount / t.origAmount);
          } else {
            t.origAmount = t.amount;
            t.currency = oldCode;
            t.rate = rate;
            t.amount = round2(t.amount * rate);
          }
        });
        await this.recurring.toCollection().modify((r: Recurring) => { r.amount = round2(r.amount * rate); });
        await this.budgets.toCollection().modify((b: Budget) => { b.limit = round2(b.limit * rate); });
        for (const [c, v] of Object.entries(rates)) if (c !== newCode) nextRates[c] = sig(v * rate);
        nextRates[oldCode] = sig(rate);
      } else {
        // label-only: foreign-entry rates are kept as-is; user should review them
        nextRates = { ...rates };
        delete nextRates[newCode];
      }
      await this.settings.put({ key: 'rates', value: nextRates });
      await this.settings.put({ key: 'baseCurrency', value: newCode });
    });
    setBase(newCode);
    return { converted };
  }

  // ---------- backup / restore ----------
  async exportAll() {
    const [transactions, categories, recurring, budgets, settings] = await Promise.all([
      this.transactions.toArray(), this.categories.toArray(), this.recurring.toArray(),
      this.budgets.toArray(), this.settings.toArray(),
    ]);
    return {
      app: 'kanetracker', version: 1, exportedAt: new Date().toISOString(),
      transactions, categories, recurring, budgets,
      settings: settings.filter(s => !SECRET_KEYS.has(s.key) && s.key !== 'lastBackup'),
    };
  }

  /** Replaces all data. Validates first; nothing is touched if the file is not a backup. */
  async importAll(data: any): Promise<{ transactions: number; categories: number }> {
    if (!data || data.app !== 'kanetracker' || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
      throw new Error('Not a Kanetracker backup file');
    }
    const okType = (t: any) => t === 'income' || t === 'expense';
    const txs: Transaction[] = data.transactions.filter((t: any) =>
      t && typeof t.amount === 'number' && t.amount > 0 && typeof t.date === 'string' && !isNaN(Date.parse(t.date)) &&
      typeof t.category === 'string' && okType(t.type)).map((t: any) => ({ ...t, description: t.description ?? '' }));
    const cats: Category[] = data.categories.filter((c: any) => c && typeof c.name === 'string' && okType(c.type));
    const rec: Recurring[] = (data.recurring || []).filter((r: any) => r && okType(r.type) && r.amount > 0 && r.nextDate);
    const bud: Budget[] = (data.budgets || []).filter((b: any) => b && b.category && b.limit > 0);
    const set = (data.settings || []).filter((s: any) => s && s.key && !SECRET_KEYS.has(s.key));

    await this.transaction('rw', [this.transactions, this.categories, this.recurring, this.budgets, this.settings], async () => {
      await Promise.all([this.transactions.clear(), this.categories.clear(), this.recurring.clear(), this.budgets.clear()]);
      await this.categories.bulkPut(cats);
      await this.transactions.bulkPut(txs);
      await this.recurring.bulkPut(rec);
      await this.budgets.bulkPut(bud);
      await this.settings.bulkPut(set);
      // Old backups predate the base-currency setting: their amounts are INR.
      if (!set.some((x: any) => x.key === 'baseCurrency')) await this.settings.put({ key: 'baseCurrency', value: 'INR' });
    });
    await this.loadBase();
    return { transactions: txs.length, categories: cats.length };
  }
}
