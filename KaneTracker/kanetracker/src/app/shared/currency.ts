/**
 * Base-currency state + formatting. Plain module (not a service) so the pure
 * pipe and utility code can use it. Loaded once at startup (see app.config.ts).
 */
export interface CurrencyInfo { code: string; name: string }

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee' }, { code: 'CNY', name: 'Chinese Yuan' }, { code: 'PHP', name: 'Philippine Peso' },
  { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' }, { code: 'KRW', name: 'South Korean Won' }, { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' }, { code: 'AUD', name: 'Australian Dollar' }, { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' }, { code: 'HKD', name: 'Hong Kong Dollar' }, { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' }, { code: 'THB', name: 'Thai Baht' }, { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'BDT', name: 'Bangladeshi Taka' }, { code: 'PKR', name: 'Pakistani Rupee' }, { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' }, { code: 'SAR', name: 'Saudi Riyal' }, { code: 'ZAR', name: 'South African Rand' },
  { code: 'BRL', name: 'Brazilian Real' }, { code: 'MXN', name: 'Mexican Peso' }, { code: 'TRY', name: 'Turkish Lira' },
  { code: 'NZD', name: 'New Zealand Dollar' },
];

const LOCALE: Record<string, string> = {
  INR: 'en-IN', CNY: 'zh-CN', PHP: 'en-PH', JPY: 'ja-JP', KRW: 'ko-KR', GBP: 'en-GB', EUR: 'de-DE',
  IDR: 'id-ID', VND: 'vi-VN', THB: 'th-TH', MYR: 'ms-MY', BDT: 'bn-BD', BRL: 'pt-BR', TRY: 'tr-TR',
};

/** Region → currency, used once to pick a default for a brand-new (empty) install. */
const REGION: Record<string, string> = {
  IN: 'INR', CN: 'CNY', PH: 'PHP', US: 'USD', GB: 'GBP', JP: 'JPY', KR: 'KRW', SG: 'SGD', AE: 'AED', AU: 'AUD',
  CA: 'CAD', CH: 'CHF', HK: 'HKD', ID: 'IDR', MY: 'MYR', TH: 'THB', VN: 'VND', BD: 'BDT', PK: 'PKR', LK: 'LKR',
  NP: 'NPR', SA: 'SAR', ZA: 'ZAR', BR: 'BRL', MX: 'MXN', TR: 'TRY', NZ: 'NZD',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
};

const PRESETS: Record<string, number[]> = {
  INR: [100, 200, 500, 1000], PHP: [100, 200, 500, 1000], CNY: [10, 20, 50, 100], HKD: [20, 50, 100, 200],
  USD: [5, 10, 20, 50], EUR: [5, 10, 20, 50], GBP: [5, 10, 20, 50], SGD: [5, 10, 20, 50], AUD: [5, 10, 20, 50],
  CAD: [5, 10, 20, 50], CHF: [5, 10, 20, 50], NZD: [5, 10, 20, 50],
  JPY: [500, 1000, 2000, 5000], KRW: [5000, 10000, 20000, 50000], VND: [50000, 100000, 200000, 500000],
  IDR: [20000, 50000, 100000, 200000],
};

let base = 'INR';
const fmts = new Map<string, Intl.NumberFormat>();
const compacts = new Map<string, Intl.NumberFormat>();

export const getBase = () => base;
export const isKnown = (c: string) => CURRENCIES.some(x => x.code === c);

/** Call only after persisting. Normalises unknown input to INR. */
export function setBase(code: string) {
  base = /^[A-Z]{3}$/.test(code) ? code : 'INR';
}

export function guessCurrency(lang = navigator.language || 'en-IN'): string {
  const region = lang.split('-')[1]?.toUpperCase();
  if (region && REGION[region]) return REGION[region];
  if (/^zh/i.test(lang)) return 'CNY';
  if (/^(fil|tl)/i.test(lang)) return 'PHP';
  return 'INR';
}

function make(code: string, opts: Intl.NumberFormatOptions = {}) {
  try {
    return new Intl.NumberFormat(LOCALE[code] || 'en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, ...opts });
  } catch {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
}

/** Money in the base currency, e.g. ₹1,234.5 / ¥1,234.5 / ₱1,234.5. */
export function fmtMoney(v: number | null | undefined, code = base): string {
  let f = fmts.get(code);
  if (!f) fmts.set(code, (f = make(code)));
  return f.format(v ?? 0);
}

/** Short form for chart axes. */
export function fmtCompact(n: number, code = base): string {
  if (code === 'INR') {
    return n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${+(n / 1e3).toFixed(1)}k` : `₹${n}`;
  }
  let f = compacts.get(code);
  if (!f) compacts.set(code, (f = make(code, { notation: 'compact', maximumFractionDigits: 1 })));
  return f.format(n);
}

export function symbol(code: string): string {
  try {
    const p = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(x => x.type === 'currency');
    return p?.value || code;
  } catch { return code; }
}

export const presetsFor = (code: string) => PRESETS[code] || [10, 20, 50, 100];
export const currencyName = (code: string) => CURRENCIES.find(c => c.code === code)?.name || code;
