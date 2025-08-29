import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import {
  Chart,
  ArcElement,        // For doughnut charts
  BarElement,        // For bar charts  
  LineElement,       // For line charts
  PointElement,      // For line chart points
  CategoryScale,     // For category axis
  LinearScale,       // For linear axis
  DoughnutController,// For doughnut charts
  LineController,    // For line charts
  BarController,     // For bar charts
  Legend,           // For chart legends
  Tooltip           // For chart tooltips
} from 'chart.js';

Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, DoughnutController,
  LineController, BarController, Legend, Tooltip
);

@Component({
  selector: 'app-analytics',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatFormFieldModule, ReactiveFormsModule,
    MatDatepickerModule, MatInputModule, BaseChartDirective
  ],
  template: `
    <div class="analytics-container">
      <h1>Financial Analytics</h1>

      <!-- Date Range Toggle -->
      <div class="date-range-toggle">
        <button mat-raised-button color="primary" (click)="showDateRange = !showDateRange" class="toggle-btn">
          <mat-icon>{{ showDateRange ? 'visibility_off' : 'date_range' }}</mat-icon>
          {{ showDateRange ? 'Hide Date Range' : 'Select Date Range' }}
        </button>
      </div>

      <!-- Date Range Picker -->
      <mat-card class="date-range-card" *ngIf="showDateRange">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>date_range</mat-icon>
            Select Date Range
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="date-range-controls">
            <div class="preset-buttons">
              <button mat-button (click)="setDateRange('last7Days')" class="preset-btn">Last 7 Days</button>
              <button mat-button (click)="setDateRange('last30Days')" class="preset-btn">Last 30 Days</button>
              <button mat-button (click)="setDateRange('last3Months')" class="preset-btn">Last 3 Months</button>
              <button mat-button (click)="setDateRange('lastYear')" class="preset-btn">Last Year</button>
              <button mat-button (click)="setDateRange('allTime')" class="preset-btn">All Time</button>
            </div>
            <mat-form-field appearance="outline" class="date-range-field">
              <mat-label>Custom Date Range</mat-label>
              <mat-date-range-input [formGroup]="rangeForm" [rangePicker]="picker">
                <input matStartDate formControlName="start" placeholder="Start date">
                <input matEndDate formControlName="end" placeholder="End date">
              </mat-date-range-input>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-date-range-picker #picker></mat-date-range-picker>
            </mat-form-field>
          </div>
          <div class="selected-range" *ngIf="currentDateRange.start && currentDateRange.end">
            <mat-icon>info</mat-icon>
            <span>
              Showing data from {{ currentDateRange.start | date:'mediumDate' }} 
              to {{ currentDateRange.end | date:'mediumDate' }}
              ({{ getDateRangeDays() }} days)
            </span>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Current Range Display -->
      <div class="current-range-display" *ngIf="!showDateRange && currentDateRange.start && currentDateRange.end">
        <mat-icon>schedule</mat-icon>
        <span>
          {{ currentDateRange.start | date:'mediumDate' }} - 
          {{ currentDateRange.end | date:'mediumDate' }}
          ({{ getDateRangeDays() }} days)
        </span>
      </div>

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

      <!-- Interactive Chart Cards -->
      <div class="charts-section">
        <!-- Category Breakdown Card -->
        <mat-card class="chart-card" (click)="toggleChart('categoryChart')">
          <mat-card-header>
            <mat-card-title>
              <div class="title-content">
                <mat-icon>pie_chart</mat-icon>
                Spending by Category
              </div>
              <mat-icon class="expand-icon" [class.rotated]="chartVisibility.categoryChart">
                {{ chartVisibility.categoryChart ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content *ngIf="chartVisibility.categoryChart">
            <div class="chart-container" *ngIf="pieChartData.datasets[0].data.length > 0; else noExpenseData">
              <canvas baseChart [data]="pieChartData" [type]="pieChartType" [options]="pieChartOptions"></canvas>
            </div>
            <ng-template #noExpenseData>
              <div class="no-data">
                <mat-icon>pie_chart_outlined</mat-icon>
                <p>No expense data available for selected period</p>
              </div>
            </ng-template>
          </mat-card-content>
          <mat-card-content *ngIf="!chartVisibility.categoryChart" class="chart-preview">
            <div class="preview-content">
              <mat-icon>visibility</mat-icon>
              <p>Click to view category breakdown chart</p>
              <span>₹{{ totalExpenses | number:'1.0-0' }} total expenses to analyze</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Monthly Trends Card -->
        <mat-card class="chart-card" (click)="toggleChart('monthlyTrends')">
          <mat-card-header>
            <mat-card-title>
              <div class="title-content">
                <mat-icon>show_chart</mat-icon>
                Monthly Trends
              </div>
              <mat-icon class="expand-icon" [class.rotated]="chartVisibility.monthlyTrends">
                {{ chartVisibility.monthlyTrends ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content *ngIf="chartVisibility.monthlyTrends">
            <div class="chart-container" *ngIf="lineChartData.datasets.length > 0; else noTrendData">
              <canvas baseChart [data]="lineChartData" [type]="lineChartType" [options]="lineChartOptions"></canvas>
            </div>
            <ng-template #noTrendData>
              <div class="no-data">
                <mat-icon>show_chart</mat-icon>
                <p>Not enough data for trends</p>
                <span>Add more transactions to see monthly patterns</span>
              </div>
            </ng-template>
          </mat-card-content>
          <mat-card-content *ngIf="!chartVisibility.monthlyTrends" class="chart-preview">
            <div class="preview-content">
              <mat-icon>visibility</mat-icon>
              <p>Click to view monthly trends chart</p>
              <span>Track income and expenses over {{ getDateRangeDays() }} days</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Income vs Expenses Card -->
        <mat-card class="chart-card full-width" (click)="toggleChart('incomeVsExpenses')">
          <mat-card-header>
            <mat-card-title>
              <div class="title-content">
                <mat-icon>bar_chart</mat-icon>
                Income vs Expenses Comparison
              </div>
              <mat-icon class="expand-icon" [class.rotated]="chartVisibility.incomeVsExpenses">
                {{ chartVisibility.incomeVsExpenses ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content *ngIf="chartVisibility.incomeVsExpenses">
            <div class="chart-container" *ngIf="barChartData.datasets.length > 0; else noComparisonData">
              <canvas baseChart [data]="barChartData" [type]="barChartType" [options]="barChartOptions"></canvas>
            </div>
            <ng-template #noComparisonData>
              <div class="no-data">
                <mat-icon>bar_chart</mat-icon>
                <p>No data for comparison</p>
                <span>Add transactions to see income vs expense patterns</span>
              </div>
            </ng-template>
          </mat-card-content>
          <mat-card-content *ngIf="!chartVisibility.incomeVsExpenses" class="chart-preview">
            <div class="preview-content">
              <mat-icon>visibility</mat-icon>
              <p>Click to view income vs expenses comparison</p>
              <span>Compare financial performance across months</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Top Categories Card -->
        <mat-card class="chart-card" (click)="toggleChart('topCategories')">
          <mat-card-header>
            <mat-card-title>
              <div class="title-content">
                <mat-icon>list_alt</mat-icon>
                Top Spending Categories
              </div>
              <mat-icon class="expand-icon" [class.rotated]="chartVisibility.topCategories">
                {{ chartVisibility.topCategories ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content *ngIf="chartVisibility.topCategories">
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
          <mat-card-content *ngIf="!chartVisibility.topCategories" class="chart-preview">
            <div class="preview-content">
              <mat-icon>visibility</mat-icon>
              <p>Click to view top spending categories</p>
              <span>Analyze your biggest expense categories</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit {
  totalIncome = 0;
  totalExpenses = 0;
  netBalance = 0;
  topCategories: { name: string; amount: number; color: string }[] = [];
  showDateRange = false;

  rangeForm = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null)
  });

  currentDateRange = {
    start: null as Date | null,
    end: null as Date | null
  };

  chartVisibility = {
    categoryChart: false,
    monthlyTrends: false,
    incomeVsExpenses: false,
    topCategories: false
  };

  // Chart configurations
  pieChartType: ChartType = 'doughnut';
  pieChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#fff' }]
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    }
  };

  lineChartType: ChartType = 'line';
  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => '₹' + Number(value).toLocaleString() }
      }
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`
        }
      }
    }
  };

  barChartType: ChartType = 'bar';
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration['options'] = this.lineChartOptions;

  constructor(private dexieService: DexieService) { }

  async ngOnInit() {
    this.setDateRange('last30Days');
    this.rangeForm.valueChanges.subscribe(value => {
      if (value.start && value.end) {
        this.currentDateRange.start = value.start;
        this.currentDateRange.end = value.end;
        this.loadSummaryData();
      }
    });
  }

  setDateRange = (preset: string) => {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case 'last7Days': start.setDate(end.getDate() - 7); break;
      case 'last30Days': start.setDate(end.getDate() - 30); break;
      case 'last3Months': start.setMonth(end.getMonth() - 3); break;
      case 'lastYear': start.setFullYear(end.getFullYear() - 1); break;
      case 'allTime': start.setFullYear(2020, 0, 1); break;
    }

    this.currentDateRange = { start, end };
    this.rangeForm.patchValue({ start, end });
    this.loadSummaryData();
  };

  getDateRangeDays = (): number => {
    if (!this.currentDateRange.start || !this.currentDateRange.end) return 0;
    const diffTime = Math.abs(this.currentDateRange.end.getTime() - this.currentDateRange.start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  toggleChart = (chartName: keyof typeof this.chartVisibility) => {
    this.chartVisibility[chartName] = !this.chartVisibility[chartName];
    if (this.chartVisibility[chartName]) {
      this.generateSpecificChart(chartName);
    }
  };

  private filterTransactionsByDateRange = (transactions: Transaction[]): Transaction[] => {
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= this.currentDateRange.start! &&
        transactionDate <= this.currentDateRange.end!;
    });
  };

  private generateMonthsMap = (startDate: Date, endDate: Date, formatOptions: Intl.DateTimeFormatOptions) => {
    const monthsMap = new Map<string, { income: number; expenses: number }>();
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (current <= endDate) {
      const monthKey = current.toLocaleDateString('en-US', formatOptions);
      monthsMap.set(monthKey, { income: 0, expenses: 0 });
      current.setMonth(current.getMonth() + 1);
    }
    return monthsMap;
  };

  private async loadSummaryData() {
    try {
      const allTransactions = await this.dexieService.getAllTransactions();
      const filteredTransactions = this.filterTransactionsByDateRange(allTransactions);
      this.calculateSummaryStats(filteredTransactions);
    } catch (error) {
      console.error('Error loading summary data:', error);
    }
  }

  private async generateSpecificChart(chartName: keyof typeof this.chartVisibility) {
    try {
      const [allTransactions, categories] = await Promise.all([
        this.dexieService.getAllTransactions(),
        this.dexieService.getAllCategories()
      ]);

      const filteredTransactions = this.filterTransactionsByDateRange(allTransactions);

      switch (chartName) {
        case 'categoryChart': this.generateCategoryChart(filteredTransactions, categories); break;
        case 'monthlyTrends': this.generateMonthlyTrendsChart(filteredTransactions); break;
        case 'incomeVsExpenses': this.generateIncomeVsExpensesChart(filteredTransactions); break;
        case 'topCategories': this.calculateTopCategories(filteredTransactions, categories); break;
      }
    } catch (error) {
      console.error(`Error loading ${chartName} data:`, error);
    }
  }

  private calculateSummaryStats(transactions: Transaction[]) {
    this.totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    this.totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    this.netBalance = this.totalIncome - this.totalExpenses;
  }

  private generateCategoryChart(transactions: Transaction[], categories: Category[]) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals: { [key: string]: number } = {};
    const categoryColors: { [key: string]: string } = {};

    expenseTransactions.forEach(t => categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount);
    categories.forEach(cat => categoryColors[cat.name] = cat.color);

    const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 8);

    this.pieChartData.labels = sortedCategories.map(([name]) => name);
    this.pieChartData.datasets[0].data = sortedCategories.map(([, amount]) => amount);
    this.pieChartData.datasets[0].backgroundColor = sortedCategories.map(([name]) => categoryColors[name] || '#e0e0e0');
  }

  private generateMonthlyTrendsChart(transactions: Transaction[]) {
    const monthsMap = this.generateMonthsMap(
      this.currentDateRange.start!,
      this.currentDateRange.end!,
      { month: 'short', year: 'numeric' }
    );

    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      const monthKey = transactionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (monthsMap.has(monthKey)) {
        const monthData = monthsMap.get(monthKey)!;
        if (t.type === 'income') monthData.income += t.amount;
        else monthData.expenses += t.amount;
      }
    });

    const months = Array.from(monthsMap.keys());
    const incomeData = Array.from(monthsMap.values()).map(v => v.income);
    const expenseData = Array.from(monthsMap.values()).map(v => v.expenses);

    this.lineChartData = {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', tension: 0.4, fill: true },
        { label: 'Expenses', data: expenseData, borderColor: '#f44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', tension: 0.4, fill: true }
      ]
    };
  }

  private generateIncomeVsExpensesChart(transactions: Transaction[]) {
    const end = new Date(this.currentDateRange.end!);
    const start = new Date(Math.max(
      this.currentDateRange.start!.getTime(),
      new Date(end.getFullYear(), end.getMonth() - 5, 1).getTime()
    ));

    const monthsMap = this.generateMonthsMap(start, end, { month: 'long' });

    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      const monthKey = transactionDate.toLocaleDateString('en-US', { month: 'long' });

      if (monthsMap.has(monthKey)) {
        const monthData = monthsMap.get(monthKey)!;
        if (t.type === 'income') monthData.income += t.amount;
        else monthData.expenses += t.amount;
      }
    });

    const months = Array.from(monthsMap.keys());
    const incomeData = Array.from(monthsMap.values()).map(v => v.income);
    const expenseData = Array.from(monthsMap.values()).map(v => v.expenses);

    this.barChartData = {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: '#4CAF50', borderColor: '#4CAF50', borderWidth: 1 },
        { label: 'Expenses', data: expenseData, backgroundColor: '#f44336', borderColor: '#f44336', borderWidth: 1 }
      ]
    };
  }

  private calculateTopCategories(transactions: Transaction[], categories: Category[]) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals: { [key: string]: number } = {};

    expenseTransactions.forEach(t => categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount);

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
