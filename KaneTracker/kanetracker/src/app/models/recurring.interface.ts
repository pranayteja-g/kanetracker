export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurring {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  account?: string;
  tags?: string[];
  freq: Freq;
  /** ISO of next occurrence not yet created. */
  nextDate: string;
  /** Day-of-month to keep when a month is shorter (monthly/yearly). */
  dom: number;
  endDate?: string;
  active: boolean;
}
