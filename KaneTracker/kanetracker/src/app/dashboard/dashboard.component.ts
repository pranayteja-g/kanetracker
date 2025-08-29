import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  totalBalance: number = 0;
  totalIncome: number = 0;
  totalExpenses: number = 0;
  recentTransactions: Transaction[] = [];
  monthlyStats = {
    currentMonth: new Date().toLocaleString('default', { month: 'long' }),
    income: 0,
    expenses: 0
  };
  topCategories: { name: string; amount: number; color: string }[] = [];

  constructor(private dexieService: DexieService) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    const transactions = await this.dexieService.getAllTransactions();
    const categories = await this.dexieService.getAllCategories();
    
    // Calculate totals
    this.calculateTotals(transactions);
    
    // Get current month stats
    this.calculateMonthlyStats(transactions);
    
    // Get recent transactions (last 5)
    this.recentTransactions = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
      
    // Calculate top spending categories
    this.calculateTopCategories(transactions, categories);
  }

  private calculateTotals(transactions: Transaction[]) {
    this.totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    this.totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    this.totalBalance = this.totalIncome - this.totalExpenses;
  }

  private calculateMonthlyStats(transactions: Transaction[]) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });

    this.monthlyStats.income = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    this.monthlyStats.expenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  private calculateTopCategories(transactions: Transaction[], categories: Category[]) {
    const categoryTotals: { [key: string]: number } = {};
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });

    this.topCategories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        color: categories.find(c => c.name === name)?.color || '#e0e0e0'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }

  getCategoryColor(categoryName: string): string {
    const category = this.topCategories.find(c => c.name === categoryName);
    return category?.color || '#e0e0e0';
  }

  hexToRgba(hex: string, opacity: number = 0.15): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}
