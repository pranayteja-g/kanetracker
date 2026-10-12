import { Category } from '../models/category.interface';
import { Transaction } from '../models/transaction.interface';

type T = 'income' | 'expense';

<<<<<<< HEAD
export interface Suggestion {
  category: string;
  /** 0..1. Learned: probability × how much of the text was recognised. Rule: fixed 0.55. */
  conf: number;
  source: 'learned' | 'rule' | 'default' | 'none';
}

=======
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
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

<<<<<<< HEAD
export const STOP = new Set([
  'upi', 'the', 'for', 'and', 'txn', 'ref', 'payment', 'paid', 'transfer', 'debit', 'credit', 'bank', 'account', 'info',
  'imps', 'neft', 'pos', 'received', 'from', 'with', 'via', 'details', 'transaction',
]);

/** Lower-case words (3+ letters, no digits/stopwords). Shared by the classifier and recurring detection. */
export function words(s: string): string[] {
  return (s.toLowerCase().replace(/[^a-z\s]/g, ' ').match(/[a-z]{3,}/g) || []).filter(w => !STOP.has(w));
}

/** word tokens (weight 1) + character trigrams of longer words (weight .3) so small spelling changes still match. */
function features(desc: string): [string, number][] {
  const out: [string, number][] = [];
  for (const w of words(desc)) {
    out.push(['w:' + w, 1]);
    if (w.length >= 5) for (let i = 0; i + 3 <= w.length; i++) out.push(['t:' + w.slice(i, i + 3), 0.3]);
  }
  return out;
}

interface Model {
  docs: Map<string, number>;                       // cat → #transactions
  tok: Map<string, Map<string, number>>;           // cat → token → weight
  tot: Map<string, number>;                        // cat → total weight
  vocab: Set<string>;
  n: number;
}

/**
 * Multinomial Naive Bayes over the user's own history, one model per type (income/expense).
 * Pure TypeScript, trains in milliseconds, nothing leaves the device.
 * Falls back to keyword rules, then to an "Other" category.
 */
export function buildClassifier(history: Transaction[], cats: Category[]) {
  const names = new Map<T, Set<string>>([['income', new Set()], ['expense', new Set()]]);
  cats.forEach(c => names.get(c.type)!.add(c.name));
  const models: Record<T, Model> = {
    income: { docs: new Map(), tok: new Map(), tot: new Map(), vocab: new Set(), n: 0 },
    expense: { docs: new Map(), tok: new Map(), tot: new Map(), vocab: new Set(), n: 0 },
  };

  for (const t of history) {
    if (!t.description || !names.get(t.type)?.has(t.category)) continue;
    const f = features(t.description);
    if (!f.length) continue;
    const m = models[t.type];
    m.n++;
    m.docs.set(t.category, (m.docs.get(t.category) || 0) + 1);
    let tk = m.tok.get(t.category);
    if (!tk) m.tok.set(t.category, (tk = new Map()));
    for (const [k, w] of f) {
      tk.set(k, (tk.get(k) || 0) + w);
      m.tot.set(t.category, (m.tot.get(t.category) || 0) + w);
      m.vocab.add(k);
    }
  }

  const has = (type: T, name: string) => [...names.get(type)!].find(n => n.toLowerCase() === name.toLowerCase());
  const fallback = (type: T) => has(type, 'other') || has(type, 'misc') || has(type, 'others') || '';

  function learned(desc: string, type: T): Suggestion | null {
    const m = models[type];
    if (m.n < 5) return null;
    const f = features(desc);
    const all = f.reduce((a, [, w]) => a + w, 0);
    const known = f.filter(([k]) => m.vocab.has(k));
    const seen = known.reduce((a, [, w]) => a + w, 0);
    if (!known.length || !all) return null;

    const V = m.vocab.size, K = m.docs.size, a = 0.5;
    const logp: [string, number][] = [];
    m.docs.forEach((d, cat) => {
      const tk = m.tok.get(cat)!, tot = m.tot.get(cat)!;
      let lp = Math.log((d + 1) / (m.n + K));
      for (const [k, w] of known) lp += w * Math.log(((tk.get(k) || 0) + a) / (tot + a * V));
      logp.push([cat, lp]);
    });
    const mx = Math.max(...logp.map(x => x[1]));
    const z = logp.reduce((s, x) => s + Math.exp(x[1] - mx), 0);
    const best = logp.sort((x, y) => y[1] - x[1])[0];
    const prob = Math.exp(best[1] - mx) / z;
    return { category: best[0], conf: prob * (seen / all), source: 'learned' };
  }

  function suggest(desc: string, type: T): Suggestion {
    const l = learned(desc, type);
    if (l && l.conf >= 0.5) return l;
    for (const r of RULES) {
      if (r.type !== type || !r.re.test(desc)) continue;
      for (const n of r.names) { const hit = has(type, n); if (hit) return { category: hit, conf: 0.55, source: 'rule' }; }
    }
    if (l && l.conf >= 0.3) return l;
    const d = fallback(type);
    return d ? { category: d, conf: 0.1, source: 'default' } : { category: '', conf: 0, source: 'none' };
  }

  return { suggest };
}

/** Back-compat: returns just the category name. */
export function buildCategorizer(history: Transaction[], cats: Category[]) {
  const c = buildClassifier(history, cats);
  return (desc: string, type: T): string => c.suggest(desc, type).category;
=======
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
>>>>>>> 91f1ab019d2cec63a236787506d3f298a3addd58
}
