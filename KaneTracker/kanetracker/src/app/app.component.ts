import { Component, HostListener, OnInit, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { RouterOutlet, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from './services/dexie.service';
import { getBase } from './shared/currency';
import { LockService } from './lock/lock.service';
import { LockComponent } from './lock/lock.component';

@Component({
  selector: 'app-root',
  imports: [NgIf, RouterOutlet, LockComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'kanetracker';
  lock = inject(LockService);
  private db = inject(DexieService);
  private snack = inject(MatSnackBar);
  private sw = inject(SwUpdate);

  constructor(private router: Router) {}

  async ngOnInit() {
    // Ask the browser not to evict data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    this.watchUpdates();
    if (this.db.currencyGuessed) this.snack.open(`Currency set to ${getBase()}. Change in Settings.`, 'OK', { duration: 6000 });
    const n = this.db.recurringAdded;
    if (n) this.snack.open(`${n} recurring entr${n === 1 ? 'y' : 'ies'} added`, 'OK', { duration: 4000 });
  }

  /** New version downloaded → ask to reload. Also re-check whenever the app comes back to the foreground. */
  private watchUpdates() {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')).subscribe(() => {
      this.snack.open('Update ready', 'Reload', { duration: 0 }).onAction().subscribe(async () => {
        try { await this.sw.activateUpdate(); } catch { /* reload anyway */ }
        document.location.reload();
      });
    });
    const check = () => this.sw.checkForUpdate().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    check();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'k') {
      event.preventDefault();
      this.router.navigate(['/search']);
    }
  }
}
