import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEFAULT_ACCOUNTS, DEFAULT_RATES, DexieService } from '../services/dexie.service';
import { LockService } from '../lock/lock.service';
import { download, toCsv, toInput } from '../shared/utils';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, MatIconModule],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Settings</h1><span class="sp"></span>
      </header>

      <section class="sec">
        <div class="row-h"><h2>Data</h2></div>
        <a class="link" routerLink="/import"><mat-icon>upload_file</mat-icon>Import statement / SMS<mat-icon class="c">chevron_right</mat-icon></a>
        <a class="link" routerLink="/recurring"><mat-icon>repeat</mat-icon>Recurring<mat-icon class="c">chevron_right</mat-icon></a>
        <a class="link" routerLink="/budgets"><mat-icon>savings</mat-icon>Budgets<mat-icon class="c">chevron_right</mat-icon></a>
        <a class="link" routerLink="/categories"><mat-icon>label_outline</mat-icon>Categories<mat-icon class="c">chevron_right</mat-icon></a>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Backup</h2></div>
        <p class="muted" [class.warn]="stale">{{ lastBackup ? 'Last backup: ' + lastBackup : 'Never backed up.' }} Data lives only in this browser. Clearing site data erases it.</p>
        <div class="btns">
          <button class="btn ghost" (click)="exportJson()"><mat-icon>download</mat-icon>JSON</button>
          <button class="btn ghost" (click)="exportCsv()"><mat-icon>table_chart</mat-icon>CSV</button>
          <label class="btn ghost"><mat-icon>restore</mat-icon>Restore<input type="file" accept=".json,.csv,application/json,text/csv" hidden (change)="restore($event)" /></label>
        </div>
        <p class="muted">JSON = full backup (restore replaces everything). CSV = transactions only.</p>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Currencies</h2></div>
        <p class="muted">Rate = ₹ per 1 unit. Amounts are stored in ₹ at the rate used when added.</p>
        <div class="rate" *ngFor="let c of rateKeys"><b>{{ c }}</b><input type="number" inputmode="decimal" min="0" step="0.01" [(ngModel)]="rates[c]" (change)="saveRates()" />
          <button class="icon-btn" (click)="delRate(c)" aria-label="Remove"><mat-icon>close</mat-icon></button></div>
        <div class="rate"><input class="code" placeholder="Code e.g. CAD" maxlength="3" [(ngModel)]="newCode" />
          <input type="number" inputmode="decimal" placeholder="Rate" [(ngModel)]="newRate" />
          <button class="icon-btn" (click)="addRate()" aria-label="Add"><mat-icon>add</mat-icon></button></div>
      </section>

      <section class="sec">
        <div class="row-h"><h2>Accounts</h2></div>
        <div class="tagrow"><span class="chip" *ngFor="let a of accounts">{{ a }} <mat-icon (click)="delAccount(a)">close</mat-icon></span></div>
        <div class="rate"><input placeholder="New account" maxlength="20" [(ngModel)]="newAcc" (keyup.enter)="addAccount()" />
          <button class="icon-btn" (click)="addAccount()" aria-label="Add"><mat-icon>add</mat-icon></button></div>
      </section>

      <section class="sec">
        <div class="row-h"><h2>App lock</h2></div>
        <ng-container *ngIf="!lock.enabled()">
          <p class="muted">4-digit PIN. Hides the app on open and after 30s in background. Does not encrypt data.</p>
          <div class="rate"><input type="password" inputmode="numeric" maxlength="4" placeholder="New PIN" [(ngModel)]="pin" />
            <input type="password" inputmode="numeric" maxlength="4" placeholder="Repeat" [(ngModel)]="pin2" />
            <button class="btn" (click)="enableLock()">Set</button></div>
        </ng-container>
        <ng-container *ngIf="lock.enabled()">
          <div class="btns">
            <button class="btn ghost" (click)="lock.lockNow()"><mat-icon>lock</mat-icon>Lock now</button>
            <button class="btn ghost" *ngIf="lock.bioSupported && !lock.hasBio()" (click)="enableBio()"><mat-icon>fingerprint</mat-icon>Use biometric</button>
            <button class="btn ghost" *ngIf="lock.hasBio()" (click)="lock.disableBio()">Biometric off</button>
            <button class="btn ghost del" (click)="disableLock()">Remove lock</button>
          </div>
          <p class="muted">Forgot PIN? Only clearing site data resets it, and that erases all data. Keep a backup.</p>
        </ng-container>
      </section>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; } .sp { width: 40px; }
    .link { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--k-line); }
    .link .c { margin-left: auto; color: var(--k-muted); }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .btn { cursor: pointer; } .del { color: #dc2626; }
    .warn { color: #b45309; }
    .rate { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .rate b { width: 48px; }
    .rate input { flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-surface); color: var(--k-ink); font: inherit; font-size: 16px; }
    .rate .code { text-transform: uppercase; }
    .tagrow { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip mat-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; cursor: pointer; }
  `],
})
export class SettingsComponent implements OnInit {
  private db = inject(DexieService);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  lock = inject(LockService);

  loaded = false;
  rates: Record<string, number> = {};
  accounts: string[] = [];
  lastBackup = '';
  stale = false;
  newCode = ''; newRate: number | null = null; newAcc = ''; pin = ''; pin2 = '';

  get rateKeys() { return Object.keys(this.rates); }

  async ngOnInit() {
    this.rates = await this.db.getSetting('rates', { ...DEFAULT_RATES });
    this.accounts = await this.db.getSetting('accounts', [...DEFAULT_ACCOUNTS]);
    const lb = await this.db.getSetting<string>('lastBackup', '');
    this.lastBackup = lb ? new Date(lb).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    this.stale = !lb || Date.now() - new Date(lb).getTime() > 30 * 864e5;
    this.loaded = true;
  }

  back() { history.length > 1 ? history.back() : this.router.navigate(['/dashboard']); }
  private toast(m: string) { this.snack.open(m, 'OK', { duration: 4000 }); }

  async exportJson() {
    download(`kanetracker-${toInput(new Date())}.json`, 'application/json', JSON.stringify(await this.db.exportAll()));
    await this.markBackup();
  }

  async exportCsv() {
    const txs = await this.db.getTransactionsNewestFirst();
    const rows: (string | number | undefined)[][] = [['Date', 'Type', 'Category', 'Amount', 'Description', 'Account', 'Tags', 'Currency', 'OrigAmount', 'Rate']];
    for (const t of txs) rows.push([toInput(new Date(t.date)), t.type, t.category, t.amount, t.description, t.account, (t.tags || []).join(' '), t.currency, t.origAmount, t.rate]);
    download(`kanetracker-${toInput(new Date())}.csv`, 'text/csv', toCsv(rows));
    await this.markBackup();
  }

  private async markBackup() {
    const now = new Date().toISOString();
    await this.db.setSetting('lastBackup', now);
    this.lastBackup = new Date(now).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    this.stale = false;
  }

  async restore(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.csv')) { this.toast('CSV has no categories/budgets. Use Import statement for CSV.'); this.router.navigate(['/import']); return; }
    try {
      const data = JSON.parse(await f.text());
      const n = data?.transactions?.length ?? 0;
      if (!confirm(`Replace ALL current data with this backup (${n} transactions)?`)) return;
      const r = await this.db.importAll(data);
      this.toast(`Restored ${r.transactions} transactions`);
      await this.ngOnInit();
    } catch (e: any) {
      this.toast(e?.message?.includes('Not a Kanetracker') ? e.message : 'Invalid backup file');
    }
  }

  async saveRates() {
    for (const k of this.rateKeys) if (!(this.rates[k] > 0)) delete this.rates[k];
    await this.db.setSetting('rates', this.rates);
  }
  async delRate(c: string) { delete this.rates[c]; await this.saveRates(); }
  async addRate() {
    const c = this.newCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c) || c === 'INR' || !(Number(this.newRate) > 0)) return this.toast('Enter 3-letter code and rate');
    this.rates[c] = Number(this.newRate);
    this.newCode = ''; this.newRate = null;
    await this.saveRates();
  }

  async addAccount() {
    const a = this.newAcc.trim();
    if (!a || this.accounts.some(x => x.toLowerCase() === a.toLowerCase())) return;
    this.accounts = [...this.accounts, a]; this.newAcc = '';
    await this.db.setSetting('accounts', this.accounts);
  }
  async delAccount(a: string) {
    this.accounts = this.accounts.filter(x => x !== a);
    await this.db.setSetting('accounts', this.accounts);
  }

  async enableLock() {
    if (!/^\d{4}$/.test(this.pin) || this.pin !== this.pin2) return this.toast('PINs must match (4 digits)');
    await this.lock.setPin(this.pin);
    this.lock.locked.set(false);
    this.pin = this.pin2 = '';
  }
  async enableBio() { this.toast((await this.lock.enableBio()) ? 'Biometric on' : 'Biometric failed'); }
  async disableLock() { if (confirm('Remove app lock?')) await this.lock.disable(); }
}
