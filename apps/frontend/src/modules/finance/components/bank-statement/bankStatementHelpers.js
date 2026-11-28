import { api } from '@/lib/axios';

export const GST_TREATMENTS = [
  'Unreviewed',
  'Sales receipt',
  'Purchase: ITC to verify',
  'ITC blocked / not eligible',
  'Exempt / Non-GST',
  'Not a supply (capital / loan / own transfer)',
  'Government fee / tax',
  'Reverse charge check'
];

export const MONTHS_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatINRBank(val) {
  const num = Number(val || 0);
  if (!Number.isFinite(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Format YYYY-MM-DD (or date string) cleanly to 30-Apr-2026 without timezone shift
 */
export function formatBankDisplayDate(val) {
  if (!val) return '—';
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yr = isoMatch[1];
    const mo = parseInt(isoMatch[2], 10);
    const dy = isoMatch[3];
    if (mo >= 1 && mo <= 12) {
      return `${dy}-${SHORT_MONTHS[mo - 1]}-${yr}`;
    }
  }
  return s;
}

/**
 * Derive Month & Financial Year (e.g. April, 26-27) from YYYY-MM-DD
 */
export function deriveMonthAndFY(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { month: '', finYear: '' };
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const month = MONTHS_LIST[mo - 1] || '';
  const fyStart = mo >= 4 ? y : y - 1;
  return {
    month,
    finYear: `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`
  };
}

/**
 * Live GSTIN format & Mod-36 checksum validation
 */
export function validateGstinClient(gstin) {
  if (!gstin || !String(gstin).trim()) return { valid: true, isBlank: true, cleaned: '' };
  const clean = String(gstin).trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    return { valid: false, isBlank: false, cleaned: clean, error: 'Expected 15-character GSTIN (e.g. 33AABCU9603R1ZM)' };
  }
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = chars.indexOf(clean[i]);
    if (code === -1) return { valid: false, isBlank: false, cleaned: clean, error: 'Invalid character in GSTIN' };
    const prod = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  const expected = chars[(36 - (sum % 36)) % 36];
  if (clean[14] !== expected) {
    return { valid: false, isBlank: false, cleaned: clean, error: `Invalid check digit (expected ${expected}, got ${clean[14]})` };
  }
  return { valid: true, isBlank: false, cleaned: clean };
}

/**
 * Trigger authenticated file download via axios blob
 */
export async function downloadAuthenticatedExcel(url, fallbackFilename) {
  const res = await api.get(url, { responseType: 'blob' });
  const disposition = res.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objUrl);
}
