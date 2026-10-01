import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Recurring } from '../models/recurring.interface';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, RouterLink, MatIconModule, InrPipe],
  template: `
    <div class="page" *ngIf="loaded">
      <header class="top">
        <button class="icon-btn" (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <h1>Recurring</h1>
        <a routerLink="/transaction-form" class="icon-btn" aria-label="Add"><mat-icon>add</mat-icon></a>
      </header>
      <p class="muted">To add one: new transaction → pick "Repeats". Due entries are created when you open the app.</p>
      <div class="row" *ngFor="let r of rules">
        <span class="m"><b>{{ r.description || r.category }}</b>
          <span>{{ r.freq }} · {{ r.active ? 'next ' + (r.nextDate | date:'d MMM y') : 'ended / paused' }}</span></span>
        <span class="a" [class.income]="r.type === 'income'">{{ r.type === 'income' ? '+' : '−' }}{{ r.amount | inr }}</span>
        <button class="icon-btn" (click)="toggle(r)" [attr.aria-label]="r.active ? 'Pause' : 'Resume'"><mat-icon>{{ r.active ? 'pause' : 'play_arrow' }}</mat-icon></button>
        <button class="icon-btn" (click)="remove(r)" aria-label="Delete"><mat-icon>delete_outline</mat-icon></button>
      </div>
      <div class="empty" *ngIf="!rules.length"><mat-icon>repeat</mat-icon><p>No recurring entries</p></div>
    </div>
  `,
  styles: [`
    .top { justify-content: flex-start; gap: 4px; } .top h1 { flex: 1; }
    .row { display: flex; align-items: center; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--k-line); }
    .m { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .m span { font-size: 13px; color: var(--k-muted); }
    .a { font-weight: 500; font-variant-numeric: tabular-nums; margin-right: 4px; }
    .a.income { color: var(--k-income); }
  `],
})
export class RecurringComponent implements OnInit {
  private db = inject(DexieService);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  rules: Recurring[] = [];
  loaded = false;

  async ngOnInit() { await this.load(); this.loaded = true; }
  private async load() { this.rules = await this.db.recurring.toArray(); }
  back() { history.length > 1 ? history.back() : this.router.navigate(['/settings']); }

  async toggle(r: Recurring) {
    await this.db.recurring.update(r.id!, { active: !r.active });
    await this.load();
  }

  async remove(r: Recurring) {
    if (!confirm('Delete this rule? Past entries stay.')) return;
    await this.db.recurring.delete(r.id!);
    await this.load();
    this.snack.open('Rule deleted', undefined, { duration: 1500 });
  }
}
