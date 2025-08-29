import { Routes } from '@angular/router';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LayoutComponent } from './layout/layout.component';
import { CategorymanagementComponent } from './categorymanagement/categorymanagement.component';

export const routes: Routes = [
    {
        path: '',
        component: LayoutComponent,
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent },
            { path: 'transactions', component: TransactionsComponent },
            { path: 'transaction-form', component: TransactionFormComponent },
            { path: 'categories', component: CategorymanagementComponent },
        ]
    }
];
