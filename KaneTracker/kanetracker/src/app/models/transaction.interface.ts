export interface Transaction{
    id ?: number;
    amount: number;
    category: string;
    date: string;
    description: string;
    type: 'income' | 'expense';
}