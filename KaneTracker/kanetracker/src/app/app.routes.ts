import { Routes } from '@angular/router';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';

export const routes: Routes = [
    { path: '', redirectTo: '/transactions', pathMatch: 'full' },
    { path: 'transactions', component: TransactionsComponent },
    { path: 'transaction-form', component: TransactionFormComponent }
];
