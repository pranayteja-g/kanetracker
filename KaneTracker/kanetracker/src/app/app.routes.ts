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
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'recurring', loadComponent: () => import('./recurring/recurring.component').then(m => m.RecurringComponent) },
      { path: 'budgets', loadComponent: () => import('./budgets/budgets.component').then(m => m.BudgetsComponent) },
      { path: 'import', loadComponent: () => import('./import/import.component').then(m => m.ImportComponent) },
      { path: 'summary', loadComponent: () => import('./summary/summary.component').then(m => m.SummaryComponent) },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];
