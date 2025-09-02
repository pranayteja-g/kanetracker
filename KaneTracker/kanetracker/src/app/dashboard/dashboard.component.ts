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

  // Enhanced period management
  selectedPeriod: string = 'currentMonth';
  availablePeriods = [
    { value: 'currentMonth', label: 'This Month', icon: 'today' },
    { value: 'lastMonth', label: 'Last Month', icon: 'last_page' },
    { value: 'last3Months', label: '3 Months', icon: 'date_range' },
    { value: 'thisYear', label: 'This Year', icon: 'calendar_today' },
    { value: 'allTime', label: 'All Time', icon: 'history' }
  ];
  currentPeriodLabel: string = 'This Month';
  trendComparison: string = '';
  showPeriodSelector: boolean = false;

  monthlyStats = {
    currentMonth: new Date().toLocaleString('default', { month: 'long' }),
    income: 0,
    expenses: 0
  };

  topCategories: { name: string; amount: number; color: string; percentage: number }[] = [];

  constructor(private dexieService: DexieService) { }

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    const transactions = await this.dexieService.getAllTransactions();
    const categories = await this.dexieService.getAllCategories();

    // Calculate stats based on selected period
    this.calculatePeriodStats(transactions);

    // Calculate trend comparison
    this.calculateTrendComparison(transactions);

    // Get recent transactions from selected period
    const periodTransactions = this.filterTransactionsByPeriod(transactions, this.selectedPeriod);
    this.recentTransactions = periodTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    // Calculate top spending categories for the selected period
    this.calculateTopCategories(periodTransactions, categories);
  }

  private calculatePeriodStats(transactions: Transaction[]) {
    const filteredTransactions = this.filterTransactionsByPeriod(transactions, this.selectedPeriod);

    this.totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalBalance = this.totalIncome - this.totalExpenses;

    // Update monthly stats to reflect selected period
    this.monthlyStats.income = this.totalIncome;
    this.monthlyStats.expenses = this.totalExpenses;
    this.monthlyStats.currentMonth = this.currentPeriodLabel;
  }

  togglePeriodSelector() {
    this.showPeriodSelector = !this.showPeriodSelector;
  }

  private filterTransactionsByPeriod(transactions: Transaction[], period: string): Transaction[] {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    switch (period) {
      case 'currentMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'allTime':
        startDate = new Date(2020, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }

  private calculateTrendComparison(transactions: Transaction[]) {
    if (this.selectedPeriod === 'currentMonth') {
      const lastMonthTransactions = this.filterTransactionsByPeriod(transactions, 'lastMonth');
      const lastMonthTotal = lastMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      if (lastMonthTotal > 0) {
        const percentChange = ((this.totalExpenses - lastMonthTotal) / lastMonthTotal * 100);
        const direction = percentChange >= 0 ? 'more' : 'less';
        this.trendComparison = `${Math.abs(percentChange).toFixed(0)}% ${direction} than last month`;
      }
    } else {
      this.trendComparison = '';
    }
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
        color: categories.find(c => c.name === name)?.color || '#e0e0e0',
        percentage: this.totalExpenses > 0 ? (amount / this.totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }

  onPeriodChange(period: string) {
    this.selectedPeriod = period;
    this.currentPeriodLabel = this.availablePeriods.find(p => p.value === period)?.label || 'This Month';
    this.loadDashboardData();
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

  getSavingsRate(): number {
    return this.totalIncome > 0 ? ((this.totalIncome - this.totalExpenses) / this.totalIncome) * 100 : 0;
  }
}
