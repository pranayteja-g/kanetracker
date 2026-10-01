import { parseCsv } from './utils';

export interface ParsedRow {
  date: Date;
  desc: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  account?: string;
  tags?: string[];
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseNum(s: string | undefined): number {
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s.trim()) || /^-/.test(s.trim());
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return isNaN(n) ? NaN : neg ? -n : n;
}

/** dd/mm/yyyy, dd-mm-yy, dd-MMM-yyyy, yyyy-mm-dd, "12 Jan 2025". Day-first (India). */
export function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[a-z]*[-/. ,]*(\d{2,4})/);
  if (m) { const mo = MON.indexOf(m[2].toLowerCase()); return mo < 0 ? null : mk(yr(+m[3]), mo, +m[1]); }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return mk(yr(+m[3]), +m[2] - 1, +m[1]);
  return null;
}
const yr = (y: number) => (y < 100 ? 2000 + y : y);
function mk(y: number, m: number, d: number) {
  const dt = new Date(y, m, d);
  return dt.getMonth() === m && dt.getDate() === d ? dt : null;
}

export function parseStatementCsv(text: string): ParsedRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.toLowerCase());
  const find = (...re: RegExp[]) => head.findIndex(h => re.some(r => r.test(h)));
  const iDate = find(/^date$/, /txn.*date|trans.*date|value date|posting/, /date/);
  const iDesc = find(/desc|narration|particular|remark|details|note/);
  const iDr = find(/debit|withdraw|^dr\b|paid out/);
  const iCr = find(/credit|deposit|^cr\b|paid in/);
  const iAmt = find(/^amount|^amt/);
  const iType = find(/^type$|dr\/cr|cr\/dr/);
  const iCat = find(/^category$/);
  const iAcc = find(/^account$/);
  const iTags = find(/^tags?$/);
  if (iDate < 0 || (iAmt < 0 && iDr < 0 && iCr < 0)) return [];

  const out: ParsedRow[] = [];
  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate]);
    if (!date) continue;
    let amount = NaN, type: 'income' | 'expense' = 'expense';
    if (iDr >= 0 || iCr >= 0) {
      const dr = parseNum(r[iDr]), cr = parseNum(r[iCr]);
      if (dr > 0) { amount = dr; type = 'expense'; }
      else if (cr > 0) { amount = cr; type = 'income'; }
    } else {
      const a = parseNum(r[iAmt]);
      if (!isNaN(a)) {
        amount = Math.abs(a);
        const t = (iType >= 0 ? r[iType] : '').toLowerCase();
        type = /income|credit|^cr/.test(t) ? 'income' : 'expense';
      }
    }
    if (!(amount > 0)) continue;
    out.push({
      date, amount, type,
      desc: (iDesc >= 0 ? r[iDesc] : '').slice(0, 200),
      category: iCat >= 0 ? r[iCat] || undefined : undefined,
      account: iAcc >= 0 ? r[iAcc] || undefined : undefined,
      tags: iTags >= 0 && r[iTags] ? r[iTags].split(/[\s|;]+/).filter(Boolean) : undefined,
    });
  }
  return out;
}

export function parseSms(text: string): ParsedRow[] {
  const AMT = /(?:INR|Rs\.?|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;
  let msgs = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (msgs.length === 1) {
    const lines = msgs[0].split('\n').filter(l => AMT.test(l));
    if (lines.length > 1) msgs = lines;
  }
  const out: ParsedRow[] = [];
  for (const raw of msgs) {
    const msg = raw.replace(/\s+/g, ' ');
    const am = msg.match(AMT);
    if (!am) continue;
    const amount = parseFloat(am[1].replace(/,/g, ''));
    if (!(amount > 0)) continue;
    const credit = /credited|received|deposited|refund|salary|cr\b/i.test(msg);
    const debit = /debited|spent|paid|purchase|withdrawn|sent|debit|dr\b/i.test(msg);
    const type: 'income' | 'expense' = credit && !debit ? 'income' : 'expense';
    const dm = msg.match(/(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2} [A-Za-z]{3},? \d{2,4})/);
    const date = (dm && parseDate(dm[1])) || new Date();
    const mm = msg.match(/(?:\bat|\bto|towards|\bfrom|Info:?|VPA)\s+([A-Za-z0-9@._&\- ]{3,32}?)(?=\s+(?:on|via|ref|UPI|Avl|Bal|for|\.|,)|[.,]|$)/i);
    const desc = (mm ? mm[1] : msg.slice(0, 60)).trim();
    const account = /upi|vpa/i.test(msg) ? 'UPI' : /card/i.test(msg) ? 'Card' : undefined;
    out.push({ date: new Date(date.getFullYear(), date.getMonth(), date.getDate()), desc, amount, type, account });
  }
  return out;
}
