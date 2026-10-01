import { Component, HostListener, OnInit, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from './services/dexie.service';
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

  constructor(private router: Router) {}

  async ngOnInit() {
    // Ask the browser not to evict data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    const n = this.db.recurringAdded;
    if (n) this.snack.open(`${n} recurring entr${n === 1 ? 'y' : 'ies'} added`, 'OK', { duration: 4000 });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'k') {
      event.preventDefault();
      this.router.navigate(['/search']);
    }
  }
}
