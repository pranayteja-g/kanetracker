import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [NgIf, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <router-outlet />
    <nav class="nav" *ngIf="!hideNav" aria-label="Main">
      <a routerLink="/dashboard" routerLinkActive="on"><mat-icon>home</mat-icon><span>Home</span></a>
      <a routerLink="/transactions" routerLinkActive="on"><mat-icon>receipt_long</mat-icon><span>History</span></a>
      <a routerLink="/transaction-form" class="fab" aria-label="Add transaction"><mat-icon>add</mat-icon></a>
      <a routerLink="/analytics" routerLinkActive="on"><mat-icon>insights</mat-icon><span>Stats</span></a>
      <a routerLink="/search" routerLinkActive="on"><mat-icon>search</mat-icon><span>Search</span></a>
    </nav>
  `,
  styleUrls: ['./layout.component.css'],
  host: { '[class.pad]': '!hideNav' }
})
export class LayoutComponent {
  hideNav = false;

  constructor(router: Router) {
    this.hideNav = router.url.startsWith('/transaction-form');
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => (this.hideNav = e.urlAfterRedirects.startsWith('/transaction-form')));
  }
}
