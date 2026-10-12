import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CategoryDialogComponent } from '../category-dialog/category-dialog.component';
import { Category } from '../models/category.interface';
import { Freq, Recurring } from '../models/recurring.interface';
import { Transaction } from '../models/transaction.interface';
<<<<<<< HEAD
import { DEFAULT_ACCOUNTS, DexieService, advance } from '../services/dexie.service';
import { InrPipe } from '../shared/inr.pipe';
import { compressImage, fromInput, parseTags, round2, symbol, toInput } from '../shared/utils';
import { getBase, presetsFor } from '../shared/currency';
import { buildClassifier } from '../shared/categorize';
=======
import { DEFAULT_ACCOUNTS, DEFAULT_RATES, DexieService, advance } from '../services/dexie.service';
import { InrPipe } from '../shared/inr.pipe';
import { compressImage, fromInput, parseTags, round2, symbol, toInput } from '../shared/utils';
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58

type Type = 'income' | 'expense';
interface Hints { cats: string[]; amounts: Record<string, number[]> }

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, MatIconModule, InrPipe],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css'],
})
export class TransactionFormComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private db = inject(DexieService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  @ViewChild('amount') amountEl?: ElementRef<HTMLInputElement>;

  form = this.fb.nonNullable.group({
    type: 'expense' as Type,
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(10_000_000)]],
    category: ['', Validators.required],
    date: [toInput(new Date()), Validators.required],
    description: ['', Validators.maxLength(200)],
<<<<<<< HEAD
    currency: getBase(),
=======
    currency: 'INR',
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
    account: '',
    tags: '',
    repeat: 'none' as 'none' | Freq,
  });

  maxDate = toInput(new Date(Date.now() + 7 * 864e5));
  categories: Category[] = [];
  accounts: string[] = DEFAULT_ACCOUNTS;
<<<<<<< HEAD
  base = getBase();
  currencies: string[] = [getBase()];
  rates: Record<string, number> = {};
  presets: number[] = presetsFor(getBase());
  receipt = '';
  autoPicked = false;
  private manual = false;
  private clf?: ReturnType<typeof buildClassifier>;
=======
  currencies: string[] = ['INR'];
  rates: Record<string, number> = {};
  presets: number[] = [100, 200, 500, 1000];
  receipt = '';
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
  saving = false;
  sym = symbol;

  private allCats: Category[] = [];
  private hints: Partial<Record<Type, Hints>> = {};

  get type(): Type {
    return this.form.controls.type.value;
  }

  get canSave() {
    return this.form.valid && !this.saving;
  }

<<<<<<< HEAD
  /** Base-currency value of a foreign amount, or null when entering in the base currency. */
  get converted(): number | null {
    const { currency, amount } = this.form.getRawValue();
    return currency !== this.base && amount && this.rates[currency] ? round2(amount * this.rates[currency]) : null;
=======
  /** Base-currency value of a foreign amount, or null for INR. */
  get converted(): number | null {
    const { currency, amount } = this.form.getRawValue();
    return currency !== 'INR' && amount && this.rates[currency] ? round2(amount * this.rates[currency]) : null;
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
  }

  async ngOnInit() {
    const [cats, rates, accounts] = await Promise.all([
      this.db.getAllCategories(),
<<<<<<< HEAD
      this.db.getRates(),
=======
      this.db.getSetting('rates', DEFAULT_RATES),
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
      this.db.getSetting('accounts', DEFAULT_ACCOUNTS),
    ]);
    this.allCats = cats;
    this.rates = rates;
    this.accounts = accounts;
<<<<<<< HEAD
    this.currencies = [this.base, ...Object.keys(rates).filter(c => c !== this.base)];
    await this.filterCats();
    this.form.controls.currency.valueChanges.subscribe(() => this.updatePresets());
    // learn from past entries; suggest a category while typing the note
    this.clf = buildClassifier(await this.db.getAllTransactions(), cats);
    this.form.controls.description.valueChanges.subscribe(d => this.suggestFromNote(d));
=======
    this.currencies = ['INR', ...Object.keys(rates)];
    await this.filterCats();
    this.form.controls.currency.valueChanges.subscribe(() => this.updatePresets());
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
  }

  ngAfterViewInit() {
    setTimeout(() => this.amountEl?.nativeElement.focus(), 150);
  }

<<<<<<< HEAD
  private suggestFromNote(desc: string) {
    if (this.manual || !this.clf || desc.trim().length < 3) { if (!desc.trim()) this.autoPicked = false; return; }
    const s = this.clf.suggest(desc, this.type);
    if (s.source === 'default' || s.conf < 0.55 || !this.categories.some(c => c.name === s.category)) return;
    if (this.form.controls.category.value !== s.category) this.pick(s.category, true);
    this.autoPicked = true;
=======
  async setType(t: Type) {
    if (t === this.type) return;
    this.form.patchValue({ type: t, category: '' });
    await this.filterCats();
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
  }

  async setType(t: Type) {
    if (t === this.type) return;
    this.manual = false;
    this.autoPicked = false;
    this.form.patchValue({ type: t, category: '' });
    await this.filterCats();
  }

  pick(name: string, auto = false) {
    if (!auto) { this.manual = true; this.autoPicked = false; }
    this.form.controls.category.setValue(name);
    this.updatePresets();
  }

  setAmount(n: number) {
    this.form.controls.amount.setValue(n);
  }

  toggleAccount(a: string) {
    const c = this.form.controls.account;
    c.setValue(c.value === a ? '' : a);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      this.receipt = await compressImage(f);
    } catch {
      this.snack.open('Could not read image', 'OK', { duration: 3000 });
    }
  }

  addCategory() {
    this.dialog
      .open(CategoryDialogComponent, { width: '90vw', maxWidth: '450px', data: { category: { type: this.type } } })
      .afterClosed()
      .subscribe(async r => {
        if (!r?.success) return;
        this.allCats = await this.db.getAllCategories();
        await this.filterCats(false);
        const created = this.categories[this.categories.length - 1];
        if (created) this.pick(created.name);
      });
  }

  async save() {
    if (!this.canSave) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      const when = fromInput(v.date);
      const entered = Number(v.amount);
      const tx: Transaction = {
        type: v.type,
        amount: entered,
        category: v.category.trim(),
        date: when.toISOString(),
        description: v.description.trim(),
      };
<<<<<<< HEAD
      if (v.currency !== this.base) {
=======
      if (v.currency !== 'INR') {
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
        const rate = this.rates[v.currency];
        if (!rate) throw new Error('No rate');
        Object.assign(tx, { currency: v.currency, origAmount: entered, rate, amount: round2(entered * rate) });
      }
      if (v.account) tx.account = v.account;
      const tags = parseTags(v.tags);
      if (tags.length) tx.tags = tags;
      if (this.receipt) tx.receipt = this.receipt;

      if (v.repeat !== 'none') {
        const rule: Recurring = {
          type: tx.type, amount: tx.amount, category: tx.category, description: tx.description,
          account: tx.account, tags: tx.tags, freq: v.repeat, dom: when.getDate(), active: true,
          nextDate: advance(when, v.repeat, when.getDate()).toISOString(),
        };
        // rule + first entry together, or neither
        await this.db.transaction('rw', this.db.recurring, this.db.transactions, async () => {
          tx.recurringId = await this.db.recurring.add(rule);
          await this.db.addTransaction(tx);
        });
      } else {
        await this.db.addTransaction(tx);
      }
      this.snack.open('Saved', undefined, { duration: 1500 });
      this.router.navigate(['/dashboard']);
    } catch {
      this.snack.open('Save failed. Try again.', 'OK', { duration: 4000 });
      this.saving = false;
    }
  }

  close() {
    history.length > 1 ? history.back() : this.router.navigate(['/dashboard']);
  }

  /** Categories of the current type, most-used first; pre-selects the top one. */
  private async filterCats(preselect = true) {
    const t = this.type;
    if (!this.hints[t]) this.hints[t] = await this.db.getFormHints(t);
    const rank = new Map(this.hints[t]!.cats.map((n, i) => [n, i]));
    this.categories = this.allCats
      .filter(c => c.type === t)
      .sort((a, b) => (rank.get(a.name) ?? 1e9) - (rank.get(b.name) ?? 1e9));
    if (preselect && !this.form.controls.category.value && rank.size && this.categories.length) {
      this.form.controls.category.setValue(this.categories[0].name);
    }
    this.updatePresets();
  }

  private updatePresets() {
    const { currency, category, type } = this.form.getRawValue();
<<<<<<< HEAD
    const std = presetsFor(currency);
    if (currency !== this.base) { this.presets = std; return; }
    const own = this.hints[type]?.amounts[category] || [];
    this.presets = [...new Set([...own, ...std])].slice(0, 5);
=======
    if (currency !== 'INR') { this.presets = [10, 50, 100, 500]; return; }
    const own = this.hints[type]?.amounts[category] || [];
    this.presets = [...new Set([...own, 100, 200, 500, 1000])].slice(0, 5);
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
  }
}
