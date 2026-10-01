export interface Transaction {
  id?: number;
  /** Always in base currency (INR) so every total/chart keeps working. */
  amount: number;
  category: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  /** Set only for foreign-currency entries. */
  currency?: string;
  origAmount?: number;
  rate?: number;
  account?: string;
  tags?: string[];
  /** Compressed JPEG data URL. */
  receipt?: string;
  recurringId?: number;
}
