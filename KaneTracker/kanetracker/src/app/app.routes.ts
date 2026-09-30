import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'transactions', loadComponent: () => import('./transactions/transactions.component').then(m => m.TransactionsComponent) },
      { path: 'transaction-form', loadComponent: () => import('./transaction-form/transaction-form.component').then(m => m.TransactionFormComponent) },
      { path: 'categories', loadComponent: () => import('./categorymanagement/categorymanagement.component').then(m => m.CategorymanagementComponent) },
      { path: 'analytics', loadComponent: () => import('./analytics/analytics.component').then(m => m.AnalyticsComponent) },
      { path: 'search', loadComponent: () => import('./search/search.component').then(m => m.SearchComponent) },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];
