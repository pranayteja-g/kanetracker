import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import {
  Chart,
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  PieController,
  Filler,
  Legend,
  Title,
  Tooltip
} from 'chart.js';

// Register Chart.js components - ADD THIS!
Chart.register(
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  PieController,
  Filler,
  Legend,
  Title,
  Tooltip
);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    BaseChartDirective
  ],
  template: `
    <div class="analytics-container">
      <h1>Financial Analytics</h1>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card income">
          <div class="summary-icon">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div class="summary-info">
            <h3>Total Income</h3>
            <p>₹{{ totalIncome | number:'1.2-2' }}</p>
          </div>
        </div>

        <div class="summary-card expense">
          <div class="summary-icon">
            <mat-icon>trending_down</mat-icon>
          </div>
          <div class="summary-info">
            <h3>Total Expenses</h3>
            <p>₹{{ totalExpenses | number:'1.2-2' }}</p>
          </div>
        </div>

        <div class="summary-card balance" [class.positive]="netBalance >= 0" [class.negative]="netBalance < 0">
          <div class="summary-icon">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="summary-info">
            <h3>Net Balance</h3>
            <p>₹{{ netBalance | number:'1.2-2' }}</p>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        
        <!-- Category Breakdown (Pie Chart) -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>pie_chart</mat-icon>
              Spending by Category
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container" *ngIf="pieChartData.datasets[0].data.length > 0; else noExpenseData">
              <canvas baseChart
                [data]="pieChartData"
                [type]="pieChartType"
                [options]="pieChartOptions">
              </canvas>
            </div>
            <ng-template #noExpenseData>
              <div class="no-data">
                <mat-icon>pie_chart_outlined</mat-icon>
                <p>No expense data available</p>
              </div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <!-- Monthly Trends (Line Chart) -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>show_chart</mat-icon>
              Monthly Trends
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container" *ngIf="lineChartData.datasets.length > 0; else noTrendData">
              <canvas baseChart
                [data]="lineChartData"
                [type]="lineChartType"
                [options]="lineChartOptions">
              </canvas>
            </div>
            <ng-template #noTrendData>
              <div class="no-data">
                <mat-icon>show_chart</mat-icon>
                <p>Not enough data for trends</p>
                <span>Add more transactions to see monthly patterns</span>
              </div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <!-- Income vs Expenses (Bar Chart) -->
        <mat-card class="chart-card full-width">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>bar_chart</mat-icon>
              Income vs Expenses Comparison
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container" *ngIf="barChartData.datasets.length > 0; else noComparisonData">
              <canvas baseChart
                [data]="barChartData"
                [type]="barChartType"
                [options]="barChartOptions">
              </canvas>
            </div>
            <ng-template #noComparisonData>
              <div class="no-data">
                <mat-icon>bar_chart</mat-icon>
                <p>No data for comparison</p>
                <span>Add transactions to see income vs expense patterns</span>
              </div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <!-- Top Categories List -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>list_alt</mat-icon>
              Top Spending Categories
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="top-categories" *ngIf="topCategories.length > 0; else noTopCategories">
              <div *ngFor="let category of topCategories; let i = index" class="category-row">
                <div class="category-rank">{{ i + 1 }}</div>
                <div class="category-dot" [style.background]="category.color"></div>
                <div class="category-details">
                  <span class="category-name">{{ category.name }}</span>
                  <span class="category-amount">₹{{ category.amount | number:'1.2-2' }}</span>
                </div>
                <div class="category-percentage">
                  {{ (category.amount / totalExpenses * 100) | number:'1.0-0' }}%
                </div>
              </div>
            </div>
            <ng-template #noTopCategories>
              <div class="no-data">
                <mat-icon>category</mat-icon>
                <p>No expense categories</p>
                <span>Start logging expenses to see top categories</span>
              </div>
            </ng-template>
          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  // Data properties
  totalIncome = 0;
  totalExpenses = 0;
  netBalance = 0;
  topCategories: { name: string; amount: number; color: string }[] = [];

  // Pie Chart Configuration - Fixed typing
  pieChartType: ChartType = 'doughnut';
  pieChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.parsed;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Line Chart Configuration
  lineChartType: ChartType = 'line';
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return '₹' + Number(value).toLocaleString();
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    }
  };

  // Bar Chart Configuration
  barChartType: ChartType = 'bar';
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return '₹' + Number(value).toLocaleString();
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    }
  };

  constructor(private dexieService: DexieService) { }

  async ngOnInit() {
    await this.loadAnalyticsData();
  }

  async loadAnalyticsData() {
    try {
      const [transactions, categories] = await Promise.all([
        this.dexieService.getAllTransactions(),
        this.dexieService.getAllCategories()
      ]);

      this.calculateSummaryStats(transactions);
      this.generateCategoryChart(transactions, categories);
      this.generateMonthlyTrendsChart(transactions);
      this.generateIncomeVsExpensesChart(transactions);
      this.calculateTopCategories(transactions, categories);

    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  }

  calculateSummaryStats(transactions: Transaction[]) {
    this.totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    this.netBalance = this.totalIncome - this.totalExpenses;
  }

  generateCategoryChart(transactions: Transaction[], categories: Category[]) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals: { [key: string]: number } = {};
    const categoryColors: { [key: string]: string } = {};

    // Group by category
    expenseTransactions.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    // Get colors from categories
    categories.forEach(cat => {
      categoryColors[cat.name] = cat.color;
    });

    // Prepare chart data
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    // Fix: Update datasets[0] directly, not the entire object
    this.pieChartData.labels = sortedCategories.map(([name]) => name);
    this.pieChartData.datasets[0].data = sortedCategories.map(([, amount]) => amount);
    this.pieChartData.datasets[0].backgroundColor = sortedCategories.map(([name]) => categoryColors[name] || '#e0e0e0');
  }

  generateMonthlyTrendsChart(transactions: Transaction[]) {
    const months: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.push(monthKey);

      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === date.getMonth() &&
          transactionDate.getFullYear() === date.getFullYear();
      });

      const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      incomeData.push(monthIncome);
      expenseData.push(monthExpenses);
    }

    this.lineChartData = {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  generateIncomeVsExpensesChart(transactions: Transaction[]) {
    const months: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    for (let i = 2; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toLocaleDateString('en-US', { month: 'long' });
      months.push(monthKey);

      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === date.getMonth() &&
          transactionDate.getFullYear() === date.getFullYear();
      });

      const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      incomeData.push(monthIncome);
      expenseData.push(monthExpenses);
    }

    this.barChartData = {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#4CAF50',
          borderColor: '#4CAF50',
          borderWidth: 1
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#f44336',
          borderColor: '#f44336',
          borderWidth: 1
        }
      ]
    };
  }

  calculateTopCategories(transactions: Transaction[], categories: Category[]) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals: { [key: string]: number } = {};

    expenseTransactions.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    this.topCategories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        color: categories.find(c => c.name === name)?.color || '#e0e0e0'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }
}
