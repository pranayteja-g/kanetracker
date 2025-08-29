export interface Category {
  id?: number;
  name: string;
  color: string;
  type: 'income' | 'expense';
}