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
import { MatInputModule } from '@angular/material/input';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { DexieService } from '../services/dexie.service';
import { Transaction } from '../models/transaction.interface';
import { Category } from '../models/category.interface';
import {
  Chart,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, DoughnutController,
  LineController, BarController, Legend, Tooltip
} from 'chart.js';

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, DoughnutController,
  LineController, BarController, Legend, Tooltip
);

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface CategorySummary {
  name: string;
  amount: number;
  color: string;
}

interface MonthData {
  income: number;
  expenses: number;
}

interface SummaryStatItem {
  title: string;
  value: number;
  icon: string;
  class: string;
}

interface ChartConfig {
  key: 'categoryChart' | 'monthlyTrends' | 'incomeVsExpenses' | 'topCategories';
  title: string;
  icon: string;
  previewText: string;
  previewSubtext: string;
  cssClass: string;
}

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
        <button mat-raised-button color="primary" (click)="toggleDateRange()" class="toggle-btn">
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
              <button 
                *ngFor="let preset of datePresets" 
                mat-button 
                (click)="setDateRange(preset.key)" 
                class="preset-btn">
                {{ preset.label }}
              </button>
            </div>
            <mat-form-field appearance="outline" class="date-range-field">
              <mat-label>Custom Date Range</mat-label>
              <mat-date-range-input [formGroup]="rangeForm" [rangePicker]="picker">
                <input matStartDate formControlName="start" placeholder="Start date" readonly>
                <input matEndDate formControlName="end" placeholder="End date" readonly>
              </mat-date-range-input>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-date-range-picker #picker [touchUi]="isMobile"></mat-date-range-picker>
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
        <div 
          *ngFor="let summary of summaryStats" 
          class="summary-card" 
          [ngClass]="summary.class">
          <div class="summary-icon">
            <mat-icon>{{ summary.icon }}</mat-icon>
          </div>
          <div class="summary-info">
            <h3>{{ summary.title }}</h3>
            <p>₹{{ summary.value | number:'1.2-2' }}</p>
          </div>
        </div>
      </div>
      <!-- Interactive Chart Cards -->
      <div class="charts-section">
        <mat-card 
          *ngFor="let chart of chartConfigs" 
          class="chart-card"
          [ngClass]="chart.cssClass">
          <mat-card-header>
            <mat-card-title>
              <div class="title-content">
                <mat-icon>{{ chart.icon }}</mat-icon>
                {{ chart.title }}
              </div>
              <button 
                mat-icon-button 
                class="toggle-chart-btn" 
                (click)="toggleChart(chart.key)"
                [attr.aria-label]="chartVisibility[chart.key] ? 'Hide chart' : 'Show chart'">
                <mat-icon class="toggle-icon" [class.rotated]="chartVisibility[chart.key]">
                  {{ chartVisibility[chart.key] ? 'expand_less' : 'expand_more' }}
                </mat-icon>
              </button>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content *ngIf="chartVisibility[chart.key]">
            <div [ngSwitch]="chart.key">
              <!-- Category Chart -->
              <div *ngSwitchCase="'categoryChart'">
                <div class="chart-container" *ngIf="pieChartData.datasets[0].data.length > 0; else noExpenseData">
                  <canvas baseChart [data]="pieChartData" [type]="pieChartType" [options]="pieChartOptions"></canvas>
                </div>
                <ng-template #noExpenseData>
                  <div class="no-data">
                    <mat-icon>pie_chart_outlined</mat-icon>
                    <p>No expense data available for selected period</p>
                  </div>
                </ng-template>
              </div>
              <!-- Monthly Trends -->
              <div *ngSwitchCase="'monthlyTrends'">
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
              </div>
              <!-- Income vs Expenses -->
              <div *ngSwitchCase="'incomeVsExpenses'">
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
              </div>
              <!-- Top Categories -->
              <div *ngSwitchCase="'topCategories'">
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
              </div>
            </div>
          </mat-card-content>
          <mat-card-content *ngIf="!chartVisibility[chart.key]" class="chart-preview">
            <div class="preview-content">
              <mat-icon>visibility</mat-icon>
              <p>{{ chart.previewText }}</p>
              <span>{{ chart.previewSubtext }}</span>
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
  topCategories: CategorySummary[] = [];

  isMobile = false;
  showDateRange = false;
  rangeForm = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null)
  });

  currentDateRange: DateRange = { start: null, end: null };

  chartVisibility = {
    categoryChart: false,
    monthlyTrends: false,
    incomeVsExpenses: false,
    topCategories: false
  };

  readonly datePresets = [
    { key: 'last7Days', label: 'Last 7 Days' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'last3Months', label: 'Last 3 Months' },
    { key: 'lastYear', label: 'Last Year' },
    { key: 'allTime', label: 'All Time' }
  ];

  pieChartType: ChartType = 'doughnut';
  pieChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#fff' }]
  };

  lineChartType: ChartType = 'line';
  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };

  barChartType: ChartType = 'bar';
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };

  readonly pieChartOptions: ChartConfiguration['options'] = {
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

  readonly lineChartOptions: ChartConfiguration['options'] = {
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

  readonly barChartOptions: ChartConfiguration['options'] = this.lineChartOptions;

  constructor(
    private dexieService: DexieService,
    private breakpointObserver: BreakpointObserver
  ) { }

  async ngOnInit() {
    // Responsive mobile detection for touch UI
    this.isMobile = this.breakpointObserver.isMatched('(max-width: 900px)');
    this.setDateRange('lastMonth');
    this.rangeForm.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value.start && value.end) {
        this.currentDateRange = { start: value.start, end: value.end };
        this.loadSummaryData();
      }
    });
  }

  get summaryStats(): SummaryStatItem[] {
    return [
      {
        title: 'Total Income',
        value: this.totalIncome,
        icon: 'trending_up',
        class: 'income'
      },
      {
        title: 'Total Expenses',
        value: this.totalExpenses,
        icon: 'trending_down',
        class: 'expense'
      },
      {
        title: 'Net Balance',
        value: this.netBalance,
        icon: 'account_balance',
        class: `balance ${this.netBalance >= 0 ? 'positive' : 'negative'}`
      }
    ];
  }

  get chartConfigs(): ChartConfig[] {
    return [
      {
        key: 'categoryChart',
        title: 'Spending by Category',
        icon: 'pie_chart',
        previewText: 'Click the expand button to view category breakdown chart',
        previewSubtext: `₹${this.totalExpenses.toLocaleString()} total expenses to analyze`,
        cssClass: ''
      },
      {
        key: 'monthlyTrends',
        title: 'Monthly Trends',
        icon: 'show_chart',
        previewText: 'Click the expand button to view monthly trends chart',
        previewSubtext: `Track income and expenses over ${this.getDateRangeDays()} days`,
        cssClass: ''
      },
      {
        key: 'incomeVsExpenses',
        title: 'Income vs Expenses Comparison',
        icon: 'bar_chart',
        previewText: 'Click the expand button to view income vs expenses comparison',
        previewSubtext: 'Compare financial performance across months',
        cssClass: 'full-width'
      },
      {
        key: 'topCategories',
        title: 'Top Spending Categories',
        icon: 'list_alt',
        previewText: 'Click the expand button to view top spending categories',
        previewSubtext: 'Analyze your biggest expense categories',
        cssClass: ''
      }
    ];
  }

  toggleDateRange(): void {
    this.showDateRange = !this.showDateRange;
  }

  setDateRange(preset: string): void {
    const now = new Date();
    let start: Date;
    let end: Date;
    switch (preset) {
      case 'last7Days':
        end = new Date(now);
        start = new Date(now);
        start.setDate(now.getDate() - 6);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        end = new Date(now);
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'lastYear':
        end = new Date(now);
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'allTime':
        start = new Date(2020, 0, 1);
        end = new Date(now);
        break;
      default: return;
    }
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);
    this.currentDateRange = { start, end };
    this.rangeForm.patchValue({ start, end }, { emitEvent: false });
    this.loadSummaryData();
  }

  getDateRangeDays(): number {
    if (!this.currentDateRange.start || !this.currentDateRange.end) return 0;
    const diffTime = Math.abs(this.currentDateRange.end.getTime() - this.currentDateRange.start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  toggleChart(chartName: keyof typeof this.chartVisibility): void {
    this.chartVisibility[chartName] = !this.chartVisibility[chartName];
    if (this.chartVisibility[chartName]) {
      this.generateSpecificChart(chartName);
    }
  }

  private filterTransactionsByDateRange(transactions: Transaction[]): Transaction[] {
    if (!this.currentDateRange.start || !this.currentDateRange.end) return transactions;
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= this.currentDateRange.start! &&
        transactionDate <= this.currentDateRange.end!;
    });
  }

  private generateMonthsMap(startDate: Date, endDate: Date): Map<string, MonthData> {
    const monthsMap = new Map<string, MonthData>();
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      const monthKey = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthsMap.set(monthKey, { income: 0, expenses: 0 });
      current.setMonth(current.getMonth() + 1);
    }
    return monthsMap;
  }

  private async loadSummaryData(): Promise<void> {
    try {
      const allTransactions = await this.dexieService.getAllTransactions();
      const filteredTransactions = this.filterTransactionsByDateRange(allTransactions);
      this.calculateSummaryStats(filteredTransactions);
    } catch (error) {
      console.error('Error loading summary data:', error);
    }
  }

  private async generateSpecificChart(chartName: keyof typeof this.chartVisibility): Promise<void> {
    try {
      // Performance: only for visible charts and using async/await
      const [allTransactions, categories] = await Promise.all([
        this.dexieService.getAllTransactions(),
        this.dexieService.getAllCategories()
      ]);
      const filteredTransactions = this.filterTransactionsByDateRange(allTransactions);
      switch (chartName) {
        case 'categoryChart':
          this.generateCategoryChart(filteredTransactions, categories);
          break;
        case 'monthlyTrends':
          this.generateMonthlyTrendsChart(filteredTransactions);
          break;
        case 'incomeVsExpenses':
          this.generateIncomeVsExpensesChart(filteredTransactions);
          break;
        case 'topCategories':
          this.calculateTopCategories(filteredTransactions, categories);
          break;
      }
    } catch (error) {
      console.error(`Error loading ${chartName} data:`, error);
    }
  }

  private calculateSummaryStats(transactions: Transaction[]): void {
    this.totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    this.totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    this.netBalance = this.totalIncome - this.totalExpenses;
  }

  private generateCategoryChart(transactions: Transaction[], categories: Category[]): void {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals = expenseTransactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    const categoryColors = categories.reduce((acc, cat) => {
      acc[cat.name] = cat.color;
      return acc;
    }, {} as Record<string, string>);
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
    this.pieChartData = {
      labels: sortedCategories.map(([name]) => name),
      datasets: [{
        data: sortedCategories.map(([, amount]) => amount),
        backgroundColor: sortedCategories.map(([name]) => categoryColors[name] || '#e0e0e0'),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };
  }

  private generateMonthlyTrendsChart(transactions: Transaction[]): void {
    if (!this.currentDateRange.start || !this.currentDateRange.end) return;
    const monthsMap = this.generateMonthsMap(this.currentDateRange.start, this.currentDateRange.end);
    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      const monthKey = transactionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthData = monthsMap.get(monthKey);
      if (monthData) {
        if (t.type === 'income') {
          monthData.income += t.amount;
        } else {
          monthData.expenses += t.amount;
        }
      }
    });
    const months = Array.from(monthsMap.keys());
    const incomeData = Array.from(monthsMap.values()).map(v => v.income);
    const expenseData = Array.from(monthsMap.values()).map(v => v.expenses);
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

  private generateIncomeVsExpensesChart(transactions: Transaction[]): void {
    if (!this.currentDateRange.end || !this.currentDateRange.start) return;
    const end = new Date(this.currentDateRange.end);
    const start = new Date(Math.max(
      this.currentDateRange.start.getTime(),
      new Date(end.getFullYear(), end.getMonth() - 5, 1).getTime()
    ));
    const monthsMap = new Map<string, MonthData>();
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthKey = current.toLocaleDateString('en-US', { month: 'long' });
      monthsMap.set(monthKey, { income: 0, expenses: 0 });
      current.setMonth(current.getMonth() + 1);
    }
    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      const monthKey = transactionDate.toLocaleDateString('en-US', { month: 'long' });
      const monthData = monthsMap.get(monthKey);
      if (monthData) {
        if (t.type === 'income') {
          monthData.income += t.amount;
        } else {
          monthData.expenses += t.amount;
        }
      }
    });
    const months = Array.from(monthsMap.keys());
    const incomeData = Array.from(monthsMap.values()).map(v => v.income);
    const expenseData = Array.from(monthsMap.values()).map(v => v.expenses);
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

  private calculateTopCategories(transactions: Transaction[], categories: Category[]): void {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals = expenseTransactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
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
