import { Category } from '../models/category.interface';
import { Transaction } from '../models/transaction.interface';

type T = 'income' | 'expense';

const RULES: { re: RegExp; names: string[]; type: T }[] = [
  { re: /swiggy|zomato|restaurant|cafe|dominos|kfc|mcdonald|pizza|bakery|biryani|hotel/i, names: ['food', 'dining', 'restaurant', 'eating out'], type: 'expense' },
  { re: /bigbasket|blinkit|zepto|dmart|grocer|instamart|supermarket|vegetable|kirana/i, names: ['groceries', 'grocery', 'food'], type: 'expense' },
  { re: /uber|ola\b|rapido|irctc|redbus|metro|petrol|diesel|fuel|hpcl|bpcl|iocl|fastag|parking/i, names: ['transport', 'travel', 'fuel', 'commute'], type: 'expense' },
  { re: /amazon|flipkart|myntra|ajio|meesho|nykaa/i, names: ['shopping'], type: 'expense' },
  { re: /electric|bescom|bsnl|airtel|jio|vodafone|\bvi\b|recharge|broadband|water bill|gas bill|dth/i, names: ['bills', 'utilities', 'recharge'], type: 'expense' },
  { re: /netflix|spotify|hotstar|prime video|bookmyshow|youtube|subscription/i, names: ['entertainment', 'subscriptions'], type: 'expense' },
  { re: /pharma|apollo|medplus|hospital|clinic|1mg|netmeds|doctor|lab/i, names: ['health', 'medical', 'medicine'], type: 'expense' },
  { re: /\brent\b|landlord/i, names: ['rent', 'housing'], type: 'expense' },
  { re: /salary|payroll|stipend/i, names: ['salary', 'income'], type: 'income' },
  { re: /interest|dividend|refund|cashback|reversal/i, names: ['interest', 'refund', 'other income', 'income'], type: 'income' },
];

const tokens = (s: string) => (s.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOP.has(w));
const STOP = new Set(['upi', 'the', 'for', 'and', 'txn', 'ref', 'payment', 'paid', 'transfer', 'debit', 'credit', 'bank', 'account', 'info', 'imps', 'neft', 'pos']);

/** Learns token → category from the user's own history, then falls back to keyword rules. */
export function buildCategorizer(history: Transaction[], cats: Category[]) {
  const learned = new Map<string, Map<string, number>>();
  for (const t of history) {
    for (const w of tokens(t.description || '')) {
      const key = `${t.type}|${w}`;
      let m = learned.get(key);
      if (!m) learned.set(key, (m = new Map()));
      m.set(t.category, (m.get(t.category) || 0) + 1);
    }
  }
  const has = (type: T, name: string) => cats.find(c => c.type === type && c.name.toLowerCase() === name.toLowerCase())?.name;

  return (desc: string, type: T): string => {
    const score = new Map<string, number>();
    for (const w of tokens(desc)) {
      learned.get(`${type}|${w}`)?.forEach((n, cat) => score.set(cat, (score.get(cat) || 0) + n));
    }
    if (score.size) return [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const r of RULES) {
      if (r.type !== type || !r.re.test(desc)) continue;
      for (const n of r.names) { const hit = has(type, n); if (hit) return hit; }
    }
    return has(type, 'other') || has(type, 'misc') || has(type, 'others') || '';
  };
}
