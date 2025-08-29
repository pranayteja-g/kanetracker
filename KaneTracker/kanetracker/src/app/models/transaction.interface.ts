export interface Transaction{
    id ?: number;
    amount: number;
    category: string;
    date: Date;
    description: string;
    type: 'income' | 'expense';
}