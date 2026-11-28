const crypto = require('crypto');
const XLSX = require('xlsx'); // Installed from SheetJS 0.20.3 official tarball

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const SHORT_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const VALID_TREATMENTS = [
  'Unreviewed',
  'Sales receipt',
  'Purchase: ITC to verify',
  'ITC blocked / not eligible',
  'Exempt / Non-GST',
  'Not a supply (capital / loan / own transfer)',
  'Government fee / tax',
  'Reverse charge check'
];

/**
 * Current date parts in Asia/Kolkata timezone (YYYY-MM-DD)
 */
function getKolkataTodayParts(nowDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(nowDate);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    iso: `${map.year}-${map.month}-${map.day}`
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIsoDate(y, m, d) {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Format YYYY-MM-DD to dd-MMM-yyyy (e.g. 30-Apr-2026) without timezone shifting
 */
function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const s = String(isoDate).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(isoDate);
  const yr = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const dy = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return s;
  return `${pad2(dy)}-${SHORT_MONTH_LABELS[mo - 1]}-${yr}`;
}

/**
 * Parse date safely in Asia/Kolkata with NO timezone shift.
 * Supports:
 *  - Excel serial number (e.g. 46142)
 *  - dd-MMM-yy / dd-MMM-yyyy (e.g. 30-Apr-26, 14-May-2026)
 *  - dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy, dd-mm-yy (day comes first!)
 *  - yyyy-mm-dd, yyyy/mm/dd
 */
function parseStatementDate(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: false, isBlank: true, iso: null, error: 'Date is empty' };
  }

  // Handle JS Date if passed directly
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    const d = raw.getDate();
    if (!isValidCalendarDate(y, m, d)) {
      return { ok: false, isBlank: false, iso: null, error: 'Invalid Date object' };
    }
    return { ok: true, isBlank: false, iso: toIsoDate(y, m, d) };
  }

  const str = String(raw).trim();
  if (/^\(?blank\)?$/i.test(str) || str === '-') {
    return { ok: false, isBlank: true, iso: null, error: 'Date is blank' };
  }

  // Excel serial number (between 1950 and 2100 roughly: 18264..73050)
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const serial = Math.floor(Number(str));
    if (serial >= 1000 && serial <= 90000) {
      // Excel 1900 epoch (adjusting Excel's 1900 leap-year bug)
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      const dt = new Date(utcMs);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      if (isValidCalendarDate(y, m, d)) {
        return { ok: true, isBlank: false, iso: toIsoDate(y, m, d) };
      }
    }
  }

  // yyyy-mm-dd or yyyy/mm/dd
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s.*|T.*)?$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (!isValidCalendarDate(y, mo, d)) {
      return { ok: false, isBlank: false, iso: null, error: `Impossible calendar date "${str}"` };
    }
    return { ok: true, isBlank: false, iso: toIsoDate(y, mo, d) };
  }

  // dd-MMM-yy or dd-MMM-yyyy (also spaces or slashes)
  m = str.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = SHORT_MONTHS[m[2].toLowerCase()];
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) {
      y = y >= 70 ? 1900 + y : 2000 + y;
    }
    if (!mo || !isValidCalendarDate(y, mo, d)) {
      return { ok: false, isBlank: false, iso: null, error: `Impossible date "${str}"` };
    }
    return { ok: true, isBlank: false, iso: toIsoDate(y, mo, d) };
  }

  // dd/mm/yyyy or dd-mm-yyyy or dd/mm/yy or dd-mm-yy (day comes first!)
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) {
      y = y >= 70 ? 1900 + y : 2000 + y;
    }
    if (!isValidCalendarDate(y, mo, d)) {
      return { ok: false, isBlank: false, iso: null, error: `Impossible date "${str}" (expected dd/mm/yyyy)` };
    }
    return { ok: true, isBlank: false, iso: toIsoDate(y, mo, d) };
  }

  return { ok: false, isBlank: false, iso: null, error: `Unrecognized date format "${str}"` };
}

/**
 * Derive Month name ("April") and Indian Financial Year ("26-27") from YYYY-MM-DD
 */
function getMonthAndFY(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { month: '', finYear: '' };
  }
  const y = parseInt(isoDate.slice(0, 4), 10);
  const m = parseInt(isoDate.slice(5, 7), 10);
  const month = MONTH_NAMES[m - 1] || '';
  const fyStart = m >= 4 ? y : y - 1;
  const fyEnd = fyStart + 1;
  const finYear = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  return { month, finYear };
}

/**
 * Convert raw monetary value (number or string like "9,99,500.00") to integer paise.
 * Never uses floating point addition/subtraction for business math.
 */
function parseAmountToPaise(raw, { allowBlank = true, allowZero = true, allowNegative = false } = {}) {
  if (raw === null || raw === undefined) {
    return allowBlank
      ? { ok: true, isBlank: true, paise: 0, decimalStr: '0.00' }
      : { ok: false, isBlank: true, paise: 0, error: 'Amount is missing' };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { ok: false, isBlank: false, paise: 0, error: 'Invalid numeric amount' };
    }
    if (!allowNegative && raw < 0) {
      return { ok: false, isBlank: false, paise: 0, error: 'Negative amounts are not allowed' };
    }
    const paise = Math.round(raw * 100);
    if (!allowZero && paise === 0) {
      return { ok: false, isBlank: false, paise: 0, error: 'Amount must be greater than zero' };
    }
    return { ok: true, isBlank: false, paise, decimalStr: paiseToDecimalString(paise) };
  }

  let s = String(raw).trim();
  if (!s || /^\(?blank\)?$/i.test(s) || s === '-' || s === '--') {
    return allowBlank
      ? { ok: true, isBlank: true, paise: 0, decimalStr: '0.00' }
      : { ok: false, isBlank: true, paise: 0, error: 'Amount is missing' };
  }

  // Strip currency symbol, commas, spaces
  s = s.replace(/[₹,\s]/g, '');
  if (s.startsWith('(') && s.endsWith(')')) {
    return { ok: false, isBlank: false, paise: 0, error: 'Negative/parenthetical amount is not allowed' };
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return { ok: false, isBlank: false, paise: 0, error: `Invalid amount "${raw}"` };
  }

  const neg = s.startsWith('-');
  if (neg && !allowNegative) {
    return { ok: false, isBlank: false, paise: 0, error: `Negative amount "${raw}" is not allowed` };
  }

  const absStr = neg ? s.slice(1) : s;
  const [intPart, fracPartRaw = ''] = absStr.split('.');
  const fracPadded = (fracPartRaw + '000').slice(0, 3);
  let paise = parseInt(intPart || '0', 10) * 100 + parseInt(fracPadded.slice(0, 2), 10);
  if (parseInt(fracPadded[2], 10) >= 5) paise += 1;
  if (neg) paise = -paise;

  if (!allowZero && paise === 0) {
    return { ok: false, isBlank: false, paise: 0, error: 'Amount must be above 0' };
  }

  return { ok: true, isBlank: false, paise, decimalStr: paiseToDecimalString(paise) };
}

function paiseToDecimalString(paise) {
  const n = Math.trunc(Number(paise) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${rupees}.${pad2(rem)}`;
}

function paiseToNumber(paise) {
  return Number(paiseToDecimalString(paise));
}

function formatINRFromPaise(paise) {
  const num = paiseToNumber(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Keep long reference numbers exact as string, never scientific notation
 */
function normalizeReferenceText(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (/^\(?blank\)?$/i.test(s)) return '';
  return s;
}

/**
 * Extract transaction Mode, UTR, and Party Name from Description & Ref without modifying originals.
 */
function extractPaymentMetadata(description = '', refNo = '') {
  const desc = String(description || '').trim();
  const ref = String(refNo || '').trim();
  const combined = `${desc} ${ref}`.toUpperCase();

  let mode = '';
  let utr = '';
  let partyName = '';

  if (/\bUPI\b/i.test(combined) || desc.toUpperCase().includes('UPI/')) {
    mode = 'UPI';
  } else if (/\bNEFT\b/i.test(combined)) {
    mode = 'NEFT';
  } else if (/\bRTGS\b/i.test(combined)) {
    mode = 'RTGS';
  } else if (/\bIMPS\b/i.test(combined)) {
    mode = 'IMPS';
  } else if (/\bINB\b|\bNET BANKING\b|\bINTERNET BANKING\b|\bIB\b/i.test(combined)) {
    mode = 'Net Banking';
  } else if (/\bCHQ\b|\bCHEQUE\b|\bCLG\b/i.test(combined)) {
    mode = 'Cheque';
  }

  // Pattern 1: BY TRANSFER-UPI/CR/648670488985/PRIYANKA U/ICIC/... or UPI/DR/123456/NAME/...
  const upiSlashMatch = desc.match(/UPI\/(?:CR|DR)\/(\d{6,22})\/([^/]+)/i);
  if (upiSlashMatch) {
    utr = upiSlashMatch[1].trim();
    partyName = upiSlashMatch[2].trim();
  } else {
    // Pattern 2: NEFT / RTGS / IMPS slash or dash patterns
    const neftMatch = desc.match(/(?:NEFT|RTGS|IMPS)[-/](?:CR|DR|IN|OUT)?[-/]?([A-Z0-9]{8,24})[-/]([^/-][^/]{1,60})/i);
    if (neftMatch) {
      utr = neftMatch[1].trim();
      partyName = neftMatch[2].trim();
    } else {
      // Check standalone long UTR / ref numbers in Ref No or Description
      const refNumMatch = ref.match(/\b(\d{9,22})\b/) || desc.match(/\b(\d{10,22})\b/);
      if (refNumMatch) {
        utr = refNumMatch[1];
      } else {
        const alphaUtr = desc.match(/\b([A-Z]{4}\d{10,18})\b/i) || ref.match(/\b([A-Z]{4}\d{10,18})\b/i);
        if (alphaUtr) utr = alphaUtr[1].toUpperCase();
      }
    }
  }

  // If party still blank, check TO TRANSFER / BY TRANSFER patterns
  if (!partyName) {
    const toByMatch = desc.match(/(?:TO|BY)\s+TRANSFER[-/:]+([A-Za-z0-9 .&_-]{2,60}?)(?:\/|$|--)/i);
    if (toByMatch && !/^(UPI|NEFT|RTGS|IMPS|INB)$/i.test(toByMatch[1].trim())) {
      partyName = toByMatch[1].trim();
    }
  }

  // Clean trailing noise
  partyName = partyName.replace(/--.*$/, '').trim();

  return { mode, utr, partyName };
}

/**
 * Suggestions only (user must confirm before GST report relies on it)
 */
function suggestGstTreatment({ description = '', remarks = '', debitPaise = 0, creditPaise = 0 }) {
  const haystack = `${description} ${remarks}`.toLowerCase();

  if (haystack.includes('capital receipt') || haystack.includes('capital infus') || haystack.includes('own transfer')) {
    return {
      treatment: 'Not a supply (capital / loan / own transfer)',
      reason: 'Matched capital receipt / own transfer keyword (suggestion only)'
    };
  }
  if (haystack.includes('tneb') || haystack.includes('electricity') || haystack.includes('eb bill') || haystack.includes('tangedco')) {
    return {
      treatment: 'Exempt / Non-GST',
      reason: 'Electricity utility charge — check bill for any taxable service charges'
    };
  }
  if (haystack.includes('airtel') || haystack.includes('broadband') || haystack.includes('internet') || haystack.includes('jiofiber')) {
    return {
      treatment: 'Purchase: ITC to verify',
      reason: 'Telecom / broadband service — verify tax invoice and GSTR-2B for ITC'
    };
  }
  if (haystack.includes('bank commission') || haystack.includes('bank charge') || haystack.includes('sms charge') || haystack.includes('folio charge')) {
    return {
      treatment: 'Purchase: ITC to verify',
      reason: 'Bank commission / charge — verify bank tax invoice / GST statement'
    };
  }
  if (haystack.includes('loan processing fee') || haystack.includes('processing fee')) {
    return {
      treatment: 'Purchase: ITC to verify',
      reason: 'Loan processing fee — verify lender GST invoice & eligibility'
    };
  }
  if (haystack.includes('fssai') || haystack.includes('treasury') || haystack.includes('mod charge') || haystack.includes('govt') || haystack.includes('challan')) {
    return {
      treatment: 'Government fee / tax',
      reason: 'Government / statutory fee — check reverse charge applicability'
    };
  }

  return {
    treatment: 'Unreviewed',
    reason: creditPaise > 0 && debitPaise === 0 ? 'Credit entry awaiting review' : 'Debit entry awaiting review'
  };
}

/**
 * Validate 15-character Indian GSTIN format + Mod-36 checksum
 */
function validateGstin(gstin) {
  if (!gstin || !String(gstin).trim()) {
    return { valid: true, isBlank: true, cleaned: '' };
  }
  const clean = String(gstin).trim().toUpperCase();
  const formatRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!formatRegex.test(clean)) {
    return { valid: false, isBlank: false, cleaned: clean, error: 'GSTIN format is invalid (expected 15 alphanumeric characters like 33AABCU9603R1ZM)' };
  }

  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = chars.indexOf(clean[i]);
    if (code === -1) {
      return { valid: false, isBlank: false, cleaned: clean, error: 'GSTIN contains invalid character' };
    }
    const factor = (i % 2 === 0) ? 1 : 2;
    const prod = code * factor;
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  const rem = sum % 36;
  const checkCode = (36 - rem) % 36;
  const expectedChar = chars[checkCode];

  if (clean[14] !== expectedChar) {
    return {
      valid: false,
      isBlank: false,
      cleaned: clean,
      error: `GSTIN check digit mismatch (expected '${expectedChar}', got '${clean[14]}')`
    };
  }

  return { valid: true, isBlank: false, cleaned: clean };
}

/**
 * Clean text consistently for dedupe & source key calculation
 */
function cleanTextForKey(val) {
  return String(val || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Compute dedupe_key, source_key, and possible_key
 */
function computeTransactionKeys({ bankAccountId, txnDate, debitPaise, creditPaise, balancePaise, description, refNo }) {
  const acct = String(bankAccountId || '');
  const dt = String(txnDate || '');
  const dr = String(Math.trunc(Number(debitPaise) || 0));
  const cr = String(Math.trunc(Number(creditPaise) || 0));
  const bal = (balancePaise === null || balancePaise === undefined) ? 'NULL' : String(Math.trunc(Number(balancePaise)));
  const cleanDesc = cleanTextForKey(description);
  const cleanRef = cleanTextForKey(refNo);

  const exactPayload = `${acct}|${dt}|${dr}|${cr}|${bal}|${cleanDesc}|${cleanRef}`;
  const possiblePayload = `${acct}|${dt}|${dr}|${cr}|${bal}`;

  return {
    dedupeKey: crypto.createHash('sha256').update(exactPayload).digest('hex'),
    possibleKey: crypto.createHash('sha256').update(possiblePayload).digest('hex')
  };
}

/**
 * Normalize header string by stripping case, spaces, punctuation
 */
function normalizeHeaderName(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  txndate: 'txnDate',
  transactiondate: 'txnDate',
  date: 'txnDate',
  valuedate: 'valueDate',
  valdate: 'valueDate',
  description: 'description',
  narration: 'description',
  particulars: 'description',
  txndescription: 'description',
  refnochequeno: 'refNo',
  refno: 'refNo',
  chequeno: 'refNo',
  chqrefno: 'refNo',
  referenceno: 'refNo',
  branchcode: 'branchCode',
  branch: 'branchCode',
  debit: 'debit',
  withdrawal: 'debit',
  withdrawalamt: 'debit',
  debitamount: 'debit',
  dr: 'debit',
  credit: 'credit',
  deposit: 'credit',
  depositamt: 'credit',
  creditamount: 'credit',
  cr: 'credit',
  balance: 'balance',
  closingbalance: 'balance',
  runningbalance: 'balance',
  remarks: 'remarks',
  remark: 'remarks',
  month: 'month',
  year: 'year',
  finyear: 'year',
  fy: 'year',
  financialyear: 'year',
  type: 'type',
  txntype: 'type'
};

/**
 * Parse uploaded Excel (.xlsx / .xls) or CSV buffer into raw 2D grid rows using SheetJS 0.20.3
 */
function parseFileBufferToGrid(buffer, filename = '') {
  const ext = String(filename).toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    throw new Error('Unsupported file format. Only .xlsx, .xls, and .csv are allowed.');
  }

  const wb = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellDates: false,
    cellNF: true,
    cellText: true
  });

  const firstSheetName = wb.SheetNames && wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded workbook has no sheets.');
  }

  const ws = wb.Sheets[firstSheetName];
  const ref = ws['!ref'];
  if (!ref) {
    throw new Error('The selected sheet is empty.');
  }

  const range = XLSX.utils.decode_range(ref);
  const grid = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) {
        row.push('');
      } else if (cell.t === 'n') {
        // Keep exact formatted text when available so long reference numbers are never truncated,
        // unless format turns small decimals/serials awkwardly; check scientific notation
        const rawNumStr = String(cell.v);
        if (cell.w && !/e\+/i.test(cell.w) && !/^#+$/.test(cell.w.trim())) {
          row.push(cell.w.trim());
        } else {
          row.push(rawNumStr);
        }
      } else {
        row.push(String(cell.w !== undefined ? cell.w : (cell.v !== undefined ? cell.v : '')).trim());
      }
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Parse pasted Excel / TSV / CSV text into 2D grid
 */
function parsePastedTextToGrid(text = '') {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const grid = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Detect tab vs comma separation
    if (line.includes('\t')) {
      grid.push(line.split('\t').map((cell) => cell.trim()));
    } else {
      // RFC4180 CSV line parse
      const row = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      row.push(cur.trim());
      grid.push(row);
    }
  }
  return grid;
}

/**
 * Find header row automatically and map column indices
 */
function findHeaderRowAndMap(grid) {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error('No rows found in statement.');
  }

  let bestIdx = -1;
  let bestMap = {};
  let bestScore = 0;

  const limit = Math.min(grid.length, 40);
  for (let r = 0; r < limit; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;

    const colMap = {};
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeaderName(row[c]);
      const canonical = HEADER_ALIASES[norm];
      if (canonical && colMap[canonical] === undefined) {
        colMap[canonical] = c;
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
      bestMap = colMap;
    }

    // Stop early if all 4 required headers found with high score
    if (colMap.txnDate !== undefined && colMap.description !== undefined && colMap.debit !== undefined && colMap.credit !== undefined && score >= 6) {
      break;
    }
  }

  const required = [
    { key: 'txnDate', label: 'Txn Date' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit' },
    { key: 'credit', label: 'Credit' }
  ];

  // If user pasted rows without a header row (e.g. 12 raw columns starting directly with sample row), check!
  if (bestScore < 3 && grid[0] && grid[0].length >= 7) {
    const firstDate = parseStatementDate(grid[0][0]);
    if (firstDate.ok) {
      return {
        headerRowIndex: -1,
        colMap: {
          txnDate: 0,
          valueDate: 1,
          description: 2,
          refNo: 3,
          branchCode: 4,
          debit: 5,
          credit: 6,
          balance: 7,
          remarks: 8,
          month: 9,
          year: 10,
          type: 11
        }
      };
    }
  }

  const missing = required.filter((req) => bestMap[req.key] === undefined).map((req) => req.label);
  if (missing.length > 0) {
    throw new Error(`Missing required statement column(s): ${missing.join(', ')}. Ensure header row contains Txn Date, Description, Debit, and Credit.`);
  }

  return { headerRowIndex: bestIdx, colMap: bestMap };
}

/**
 * Validate and normalize a single transaction row (used in both Upload Preview and Re-check/Edit)
 */
function normalizeAndValidateRow(rawRow, bankAccountId, sortOrder = 0) {
  const errors = [];

  const rawTxnDate = rawRow.txnDate ?? rawRow.txn_date ?? '';
  const rawValueDate = rawRow.valueDate ?? rawRow.value_date ?? '';
  const description = String(rawRow.description ?? '').trim();
  const refNo = normalizeReferenceText(rawRow.refNo ?? rawRow.ref_no ?? '');
  const branchCode = normalizeReferenceText(rawRow.branchCode ?? rawRow.branch_code ?? '');
  const rawDebit = rawRow.debit ?? '';
  const rawCredit = rawRow.credit ?? '';
  const rawBalance = rawRow.balance ?? '';
  const remarks = String(rawRow.remarks ?? '').trim();
  const rawMonth = String(rawRow.month ?? rawRow.txn_month ?? '').trim();
  const rawYear = String(rawRow.year ?? rawRow.fin_year ?? '').trim();
  const rawType = String(rawRow.type ?? rawRow.txn_type ?? '').trim();

  // Dates
  const parsedTxnDate = parseStatementDate(rawTxnDate);
  if (!parsedTxnDate.ok) {
    errors.push(`Txn Date: ${parsedTxnDate.error}`);
  }

  let parsedValueDate = { ok: true, iso: null };
  if (rawValueDate !== '' && rawValueDate !== null && rawValueDate !== undefined && !/^\(?blank\)?$/i.test(String(rawValueDate).trim())) {
    parsedValueDate = parseStatementDate(rawValueDate);
    if (!parsedValueDate.ok) {
      errors.push(`Value Date: ${parsedValueDate.error}`);
    }
  }

  if (!description) {
    errors.push('Description is required');
  }

  // Amounts
  const drRes = parseAmountToPaise(rawDebit, { allowBlank: true, allowZero: true, allowNegative: false });
  if (!drRes.ok) errors.push(`Debit: ${drRes.error}`);

  const crRes = parseAmountToPaise(rawCredit, { allowBlank: true, allowZero: true, allowNegative: false });
  if (!crRes.ok) errors.push(`Credit: ${crRes.error}`);

  if (drRes.ok && crRes.ok) {
    if (drRes.paise > 0 && crRes.paise > 0) {
      errors.push('Both Debit and Credit cannot be greater than 0 on the same row');
    } else if (drRes.paise === 0 && crRes.paise === 0) {
      errors.push('Either Debit or Credit must be above 0');
    }
  }

  const balRes = parseAmountToPaise(rawBalance, { allowBlank: true, allowZero: true, allowNegative: true });
  let balancePaise = null;
  if (!balRes.ok) {
    errors.push(`Balance: ${balRes.error}`);
  } else if (!balRes.isBlank) {
    balancePaise = balRes.paise;
  }

  // Month & Financial Year
  const derived = parsedTxnDate.ok ? getMonthAndFY(parsedTxnDate.iso) : { month: '', finYear: '' };
  const month = rawMonth || derived.month;
  const year = rawYear || derived.finYear;

  // Extraction
  const extracted = extractPaymentMetadata(description, refNo);

  const debitPaise = drRes.ok ? drRes.paise : 0;
  const creditPaise = crRes.ok ? crRes.paise : 0;

  // Compute dedupe/possible keys & preserve original sourceKey if already imported/parsed
  const keys = computeTransactionKeys({
    bankAccountId,
    txnDate: parsedTxnDate.iso || '',
    debitPaise,
    creditPaise,
    balancePaise,
    description,
    refNo
  });

  const sourceKey = rawRow.sourceKey || rawRow.source_key || keys.dedupeKey;
  const gstSuggestion = suggestGstTreatment({ description, remarks, debitPaise, creditPaise });

  return {
    clientId: rawRow.clientId || crypto.randomUUID(),
    sortOrder,
    txnDate: parsedTxnDate.ok ? parsedTxnDate.iso : String(rawTxnDate),
    txnDateDisplay: parsedTxnDate.ok ? formatDisplayDate(parsedTxnDate.iso) : String(rawTxnDate),
    valueDate: parsedValueDate.ok && parsedValueDate.iso ? parsedValueDate.iso : (rawValueDate ? String(rawValueDate) : ''),
    valueDateDisplay: parsedValueDate.ok && parsedValueDate.iso ? formatDisplayDate(parsedValueDate.iso) : '',
    description,
    refNo,
    branchCode,
    debit: drRes.ok ? paiseToNumber(debitPaise) : 0,
    debitPaise,
    debitRaw: rawRow.debitRaw !== undefined ? rawRow.debitRaw : (debitPaise > 0 ? paiseToDecimalString(debitPaise) : ''),
    credit: crRes.ok ? paiseToNumber(creditPaise) : 0,
    creditPaise,
    creditRaw: rawRow.creditRaw !== undefined ? rawRow.creditRaw : (creditPaise > 0 ? paiseToDecimalString(creditPaise) : ''),
    balance: balancePaise !== null ? paiseToNumber(balancePaise) : null,
    balancePaise,
    balanceRaw: rawRow.balanceRaw !== undefined ? rawRow.balanceRaw : (balancePaise !== null ? paiseToDecimalString(balancePaise) : ''),
    remarks,
    month,
    year,
    type: rawType,
    mode: extracted.mode,
    utr: extracted.utr,
    partyName: extracted.partyName,
    suggestedTreatment: gstSuggestion.treatment,
    suggestionReason: gstSuggestion.reason,
    dedupeKey: keys.dedupeKey,
    sourceKey,
    possibleKey: keys.possibleKey,
    keepPossible: Boolean(rawRow.keepPossible),
    errors,
    isValid: errors.length === 0
  };
}

/**
 * Parse grid into normalized preview rows (skipping empty rows, preserving invalid non-empty rows as Error)
 */
function parseGridToPreviewRows(grid, bankAccountId) {
  const { headerRowIndex, colMap } = findHeaderRowAndMap(grid);
  const rows = [];
  let sortIdx = 0;

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const rawCells = grid[r];
    if (!Array.isArray(rawCells)) continue;

    // Skip empty rows (where every cell is blank)
    const hasAnyValue = rawCells.some((c) => String(c || '').trim() !== '');
    if (!hasAnyValue) continue;

    const getCell = (key) => {
      const idx = colMap[key];
      return idx !== undefined && idx < rawCells.length ? rawCells[idx] : '';
    };

    // Skip repeated header row inside exports
    const firstNorm = normalizeHeaderName(getCell('txnDate'));
    if (firstNorm === 'txndate' || firstNorm === 'transactiondate') continue;

    const rawObj = {
      txnDate: getCell('txnDate'),
      valueDate: getCell('valueDate'),
      description: getCell('description'),
      refNo: getCell('refNo'),
      branchCode: getCell('branchCode'),
      debit: getCell('debit'),
      credit: getCell('credit'),
      balance: getCell('balance'),
      remarks: getCell('remarks'),
      month: getCell('month'),
      year: getCell('year'),
      type: getCell('type')
    };

    rows.push(normalizeAndValidateRow(rawObj, bankAccountId, sortIdx++));
  }

  if (rows.length === 0) {
    throw new Error('No transaction rows were found below the header row.');
  }

  return rows;
}

/**
 * Annotate rows with Duplicate, Possible Duplicate, Error, Balance Gap, and Summary Cards.
 * @param {Array} rows - normalized rows in original order
 * @param {Object} existingState - { savedKeysSet, savedPossibleMap, lastSavedBalancePaise, lastSavedDateIso }
 */
function evaluatePreviewState(rows, existingState = {}) {
  const {
    savedDedupeSet = new Set(),
    savedSourceSet = new Set(),
    savedPossibleMap = new Map(), // possibleKey -> [{ id, txnDate, description, refNo }]
    lastSavedBalancePaise = null,
    lastSavedDateIso = null
  } = existingState;

  const seenInFileExact = new Set();
  const seenInFilePossible = new Set();

  let runningPrevBalPaise = lastSavedBalancePaise;
  let runningPrevIsOverlapResolved = false;

  const annotated = rows.map((row, idx) => {
    const updated = { ...row };
    let status = 'New';
    let statusReason = 'Ready to save';
    let duplicateMatch = null;

    if (!updated.isValid || (updated.errors && updated.errors.length > 0)) {
      status = 'Error';
      statusReason = updated.errors.join('; ');
    } else if (savedDedupeSet.has(updated.dedupeKey) || savedSourceSet.has(updated.dedupeKey) || savedSourceSet.has(updated.sourceKey)) {
      status = 'Duplicate';
      statusReason = 'Already saved in database (matched dedupe/source key)';
    } else if (seenInFileExact.has(updated.dedupeKey)) {
      status = 'Duplicate';
      statusReason = 'Duplicate row inside uploaded statement';
    } else if (savedPossibleMap.has(updated.possibleKey) || seenInFilePossible.has(updated.possibleKey)) {
      status = 'Possible';
      statusReason = 'Same account, date, debit/credit and balance with different description/reference — tick Keep to save';
      duplicateMatch = savedPossibleMap.get(updated.possibleKey)?.[0] || { source: 'in-file' };
    }

    if (updated.isValid) {
      seenInFileExact.add(updated.dedupeKey);
      seenInFilePossible.add(updated.possibleKey);
    }

    // Balance Check (in original file order, warning only — does not block saving)
    let balanceGap = false;
    let expectedBalancePaise = null;
    let balanceGapDiffPaise = 0;

    if (updated.isValid && updated.balancePaise !== null) {
      if (idx === 0) {
        // Smart overlap handling:
        // If row 0 is ALREADY a saved Duplicate (overlapping upload), align runningPrevBalPaise to this row's actual balance
        // so subsequent new rows compare cleanly against this saved overlap row!
        if (status === 'Duplicate') {
          runningPrevBalPaise = updated.balancePaise;
          runningPrevIsOverlapResolved = true;
        } else if (lastSavedBalancePaise !== null) {
          // Compare row 0 against last saved balance ONLY when this row is on/after last saved date (or no overlap)
          const isBeforeLastSaved = lastSavedDateIso && updated.txnDate < lastSavedDateIso;
          if (!isBeforeLastSaved) {
            const expected = lastSavedBalancePaise + updated.creditPaise - updated.debitPaise;
            if (expected !== updated.balancePaise) {
              balanceGap = true;
              expectedBalancePaise = expected;
              balanceGapDiffPaise = updated.balancePaise - expected;
            }
          }
          runningPrevBalPaise = updated.balancePaise;
        } else {
          runningPrevBalPaise = updated.balancePaise;
        }
      } else if (runningPrevBalPaise !== null) {
        if (status === 'Duplicate' && !runningPrevIsOverlapResolved) {
          runningPrevBalPaise = updated.balancePaise;
        } else {
          const expected = runningPrevBalPaise + updated.creditPaise - updated.debitPaise;
          if (expected !== updated.balancePaise) {
            balanceGap = true;
            expectedBalancePaise = expected;
            balanceGapDiffPaise = updated.balancePaise - expected;
          }
          runningPrevBalPaise = updated.balancePaise;
        }
      } else {
        runningPrevBalPaise = updated.balancePaise;
      }
    }

    const willSave = status === 'New' || (status === 'Possible' && Boolean(updated.keepPossible));

    return {
      ...updated,
      status,
      statusReason,
      duplicateMatch,
      willSave,
      balanceGap,
      expectedBalance: expectedBalancePaise !== null ? paiseToNumber(expectedBalancePaise) : null,
      expectedBalancePaise,
      balanceGapDiff: paiseToNumber(balanceGapDiffPaise),
      balanceGapDiffPaise
    };
  });

  // Totals count ONLY rows that will be saved
  let readyCount = 0;
  let duplicateCount = 0;
  let possibleCount = 0;
  let errorCount = 0;
  let balanceGapCount = 0;
  let saveDebitPaise = 0;
  let saveCreditPaise = 0;
  let notSavedCount = 0;

  for (const r of annotated) {
    if (r.status === 'New') readyCount++;
    else if (r.status === 'Duplicate') duplicateCount++;
    else if (r.status === 'Possible') possibleCount++;
    else if (r.status === 'Error') errorCount++;

    if (r.balanceGap) balanceGapCount++;

    if (r.willSave) {
      saveDebitPaise += r.debitPaise;
      saveCreditPaise += r.creditPaise;
    } else {
      notSavedCount++;
    }
  }

  return {
    rows: annotated,
    summary: {
      totalRows: annotated.length,
      readyCount,
      willSaveCount: annotated.filter((r) => r.willSave).length,
      duplicateCount,
      possibleCount,
      errorCount,
      notSavedCount,
      balanceGapCount,
      totalDebit: paiseToNumber(saveDebitPaise),
      totalCredit: paiseToNumber(saveCreditPaise),
      totalDebitPaise: saveDebitPaise,
      totalCreditPaise: saveCreditPaise
    }
  };
}

/**
 * Calculate inclusive date range for date presets in Asia/Kolkata timezone
 */
function resolvePresetDateRange(preset, customFrom, customTo, nowDate = new Date()) {
  const { year, month, day, iso: todayIso } = getKolkataTodayParts(nowDate);
  const p = String(preset || 'ALL').toLowerCase();

  if (p === 'all') return { from: null, to: null };

  const mkUtcDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const fmtUtc = (dt) => toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  const todayUtc = mkUtcDate(year, month, day);

  if (p === 'today') {
    return { from: todayIso, to: todayIso };
  }

  if (p === 'this_week' || p === 'this week') {
    const dow = todayUtc.getUTCDay(); // 0=Sun, 1=Mon...
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(todayUtc.getTime() + offsetToMon * 86400000);
    const sun = new Date(mon.getTime() + 6 * 86400000);
    return { from: fmtUtc(mon), to: fmtUtc(sun) };
  }

  if (p === 'last_week' || p === 'last week') {
    const dow = todayUtc.getUTCDay();
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    const thisMon = new Date(todayUtc.getTime() + offsetToMon * 86400000);
    const lastMon = new Date(thisMon.getTime() - 7 * 86400000);
    const lastSun = new Date(lastMon.getTime() + 6 * 86400000);
    return { from: fmtUtc(lastMon), to: fmtUtc(lastSun) };
  }

  if (p === 'this_month' || p === 'this month') {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: toIsoDate(year, month, 1), to: toIsoDate(year, month, lastDay) };
  }

  if (p === 'last_month' || p === 'last month') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    return { from: toIsoDate(prevYear, prevMonth, 1), to: toIsoDate(prevYear, prevMonth, lastDay) };
  }

  if (p === 'this_year' || p === 'this year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  if (p === 'this_fy' || p === 'this fy') {
    const fyStart = month >= 4 ? year : year - 1;
    return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
  }

  if (p === 'last_fy' || p === 'last fy') {
    const fyStart = (month >= 4 ? year : year - 1) - 1;
    return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
  }

  if (p === 'custom') {
    const f = customFrom ? parseStatementDate(customFrom) : { ok: true, isBlank: true, iso: null };
    const t = customTo ? parseStatementDate(customTo) : { ok: true, isBlank: true, iso: null };
    if (customFrom && !f.ok) throw new Error(`Invalid From date: ${f.error}`);
    if (customTo && !t.ok) throw new Error(`Invalid To date: ${t.error}`);
    if (f.iso && t.iso && f.iso > t.iso) {
      throw new Error('From date cannot be after To date.');
    }
    return { from: f.iso || null, to: t.iso || null };
  }

  return { from: null, to: null };
}

/**
 * Prevent spreadsheet formula injection (=, +, -, @, tab, cr)
 */
function sanitizeSpreadsheetCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

module.exports = {
  MONTH_NAMES,
  VALID_TREATMENTS,
  getKolkataTodayParts,
  isValidCalendarDate,
  parseStatementDate,
  formatDisplayDate,
  getMonthAndFY,
  parseAmountToPaise,
  paiseToDecimalString,
  paiseToNumber,
  formatINRFromPaise,
  normalizeReferenceText,
  extractPaymentMetadata,
  suggestGstTreatment,
  validateGstin,
  cleanTextForKey,
  computeTransactionKeys,
  normalizeHeaderName,
  parseFileBufferToGrid,
  parsePastedTextToGrid,
  findHeaderRowAndMap,
  normalizeAndValidateRow,
  parseGridToPreviewRows,
  evaluatePreviewState,
  resolvePresetDateRange,
  sanitizeSpreadsheetCell
};
