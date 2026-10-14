export interface Quick { type: 'income' | 'expense'; amount: number; note: string }

const NUM = /^[₹$€£¥]?(\d[\d,]*(?:\.\d+)?|\.\d+)(k|l|lac|lakh|m)?$/i;
const MULT: Record<string, number> = { k: 1e3, l: 1e5, lac: 1e5, lakh: 1e5, m: 1e6 };

/** "250 swiggy", "swiggy 250", "1.5k petrol", "+50000 salary" → entry. First number-like word is the amount. */
export function parseQuick(text: string): Quick | null {
  let s = text.trim();
  if (!s) return null;
  let type: Quick['type'] = 'expense';
  if (s.startsWith('+')) { type = 'income'; s = s.slice(1).trim(); }
  const words = s.split(/\s+/);
  // amount is usually first or last word; otherwise the first number-like word
  const i = NUM.test(words[0]) ? 0 : NUM.test(words[words.length - 1]) ? words.length - 1 : words.findIndex(w => NUM.test(w));
  if (i < 0) return null;
  const m = NUM.exec(words[i])!;
  const base = Number(m[1].replace(/,/g, ''));
  const amount = Math.round(base * (m[2] ? MULT[m[2].toLowerCase()] : 1) * 100) / 100;
  if (!(amount > 0) || amount > 10_000_000) return null;
  const note = words.filter((_, j) => j !== i).join(' ').slice(0, 200);
  return { type, amount, note };
}
