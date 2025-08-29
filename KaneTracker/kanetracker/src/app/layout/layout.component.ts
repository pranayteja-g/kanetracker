// layout.component.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  template: `
    <div class="app-container">
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
      <nav class="bottom-nav">
  <button mat-button routerLink="/dashboard" routerLinkActive="active" class="nav-item">
    <mat-icon>dashboard</mat-icon>
    <span>Dashboard</span>
  </button>
  <button mat-raised-button color="primary" routerLink="/transaction-form" routerLinkActive="active" class="nav-item add-btn">
    <mat-icon>add</mat-icon>
    <span>Add</span>
  </button>
  <button mat-button routerLink="/transactions" routerLinkActive="active" class="nav-item">
    <mat-icon>list</mat-icon>
    <span>Transactions</span>
  </button>
  <button mat-button routerLink="/analytics" routerLinkActive="active" class="nav-item">
    <mat-icon>analytics</mat-icon>
    <span>Analytics</span>
  </button>
</nav>

    </div>
  `,
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent { }
