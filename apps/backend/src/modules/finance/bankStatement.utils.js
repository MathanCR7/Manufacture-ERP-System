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

  // Strip currency symbol/prefix, commas, spaces
  s = s.replace(/^(?:rs\.?|inr)\s*/i, '').replace(/\s*(?:rs\.?|inr)$/i, '');
  s = s.replace(/[₹,\s]/g, '');

  // Handle trailing Dr / Cr suffix (commonly exported in Indian Balance / Amount columns)
  let dcSuffix = '';
  const dcMatch = s.match(/^(.*?)(cr|dr)\.?$/i);
  if (dcMatch && dcMatch[1]) {
    s = dcMatch[1];
    dcSuffix = dcMatch[2].toUpperCase();
  }

  if (s.startsWith('(') && s.endsWith(')')) {
    return { ok: false, isBlank: false, paise: 0, error: 'Negative/parenthetical amount is not allowed' };
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return { ok: false, isBlank: false, paise: 0, error: `Invalid amount "${raw}"` };
  }

  if (dcSuffix === 'DR' && allowNegative && !s.startsWith('-')) {
    s = `-${s}`;
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
    // Pattern 2: Asterisk-separated NEFT/RTGS/IMPS (e.g. NEFT*HDFC0000001*HDFCH01039257470*RAJARAJAN U*BATC--)
    const starNeftMatch = desc.match(/(?:NEFT|RTGS|IMPS)\*[A-Z0-9]{4,12}\*([A-Z0-9]{8,26})\*([^*--][^*]{1,60})/i);
    if (starNeftMatch) {
      utr = starNeftMatch[1].trim();
      partyName = starNeftMatch[2].trim();
    } else {
      // Pattern 3: "UTR NO: SBIN126152075451--756052 THE TIIC LTD" or "UTR NO: SMPUTR000204--200204 SAMPLE SUPPLIER LTD"
      const utrNoMatch = desc.match(/UTR\s*(?:NO\.?|:)?\s*:?\s*([A-Z0-9]{8,26})(?:--(?:\d*\s*)?|\s+)([A-Za-z][A-Za-z0-9 .&_-]{1,60})?/i);
      if (utrNoMatch) {
        utr = utrNoMatch[1].trim();
        if (utrNoMatch[2]) partyName = utrNoMatch[2].trim();
      } else {
        // Pattern 4: NEFT / RTGS / IMPS slash or dash patterns
        const neftMatch = desc.match(/(?:NEFT|RTGS|IMPS)[-/](?:CR|DR|IN|OUT)?[-/]?([A-Z0-9]{6,24})[-/]([^/-][^/]{1,60})/i);
        if (neftMatch) {
          utr = neftMatch[1].trim();
          partyName = neftMatch[2].trim();
        } else {
          // Check standalone long UTR / ref numbers in Ref No or Description
          const refNumMatch = ref.match(/\b(\d{9,22})\b/) || desc.match(/\b(\d{10,22})\b/);
          if (refNumMatch) {
            utr = refNumMatch[1];
          } else {
            const alphaUtr =
              ref.match(/\b([A-Z]{2,6}\d+[A-Z0-9]{4,20})\b/i) ||
              desc.match(/\b([A-Z]{4}\d{10,18}|CHX\d{5,12}|SBIN\d{10,18}|[A-Z]{2,6}\d+[A-Z0-9]{6,20})\b/i);
            if (alphaUtr) utr = alphaUtr[1].toUpperCase();
          }
        }
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

  if (
    haystack.includes('capital receipt') ||
    haystack.includes('capital infus') ||
    haystack.includes('partner capital') ||
    haystack.includes('director loan') ||
    haystack.includes('own transfer')
  ) {
    return {
      treatment: 'Not a supply (capital / loan / own transfer)',
      reason: 'Matched capital / partner / own transfer keyword (suggestion only)'
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
  if (
    haystack.includes('packing') ||
    haystack.includes('raw material') ||
    haystack.includes('supplier') ||
    haystack.includes('vendor') ||
    haystack.includes('freight') ||
    haystack.includes('transport') ||
    haystack.includes('software') ||
    haystack.includes('saas') ||
    haystack.includes('subscription') ||
    haystack.includes('factory rent') ||
    haystack.includes('office rent')
  ) {
    return {
      treatment: 'Purchase: ITC to verify',
      reason: 'Business purchase / service — verify tax invoice, GSTIN, and GSTR-2B for ITC'
    };
  }
  if (haystack.includes('fssai') || haystack.includes('treasury') || haystack.includes('mod charge') || haystack.includes('govt') || haystack.includes('challan')) {
    return {
      treatment: 'Government fee / tax',
      reason: 'Government / statutory fee — check reverse charge applicability'
    };
  }
  if (creditPaise > 0 && debitPaise === 0 && (haystack.includes('customer') || haystack.includes('sales') || haystack.includes('inv'))) {
    return {
      treatment: 'Sales receipt',
      reason: 'Matched customer / sales keyword — link ERP sales invoice (suggestion only)'
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
  trandate: 'txnDate',
  transdate: 'txnDate',
  txndt: 'txnDate',
  postingdate: 'txnDate',
  postdate: 'txnDate',
  bookdate: 'txnDate',
  entrydate: 'txnDate',
  voucherdate: 'txnDate',
  dateoftransaction: 'txnDate',
  valuedate: 'valueDate',
  valdate: 'valueDate',
  valuedt: 'valueDate',
  clearingdate: 'valueDate',
  effectivedate: 'valueDate',
  settlementdate: 'valueDate',
  description: 'description',
  narration: 'description',
  particulars: 'description',
  txndescription: 'description',
  transactiondescription: 'description',
  transactionremarks: 'description',
  transactionparticulars: 'description',
  details: 'description',
  txndetails: 'description',
  paymentnarration: 'description',
  narrative: 'description',
  memo: 'description',
  refnochequeno: 'refNo',
  refno: 'refNo',
  chequeno: 'refNo',
  chqno: 'refNo',
  chqrefno: 'refNo',
  refchequeno: 'refNo',
  referenceno: 'refNo',
  referencenumber: 'refNo',
  transactionreference: 'refNo',
  transactionref: 'refNo',
  txnreference: 'refNo',
  txnref: 'refNo',
  utr: 'refNo',
  utrno: 'refNo',
  utrnumber: 'refNo',
  chequerefno: 'refNo',
  instrumentno: 'refNo',
  instno: 'refNo',
  tranid: 'refNo',
  transactionid: 'refNo',
  chequenumber: 'refNo',
  docno: 'refNo',
  voucherno: 'refNo',
  branchcode: 'branchCode',
  branch: 'branchCode',
  bankbranch: 'branchCode',
  solid: 'branchCode',
  branchid: 'branchCode',
  brcode: 'branchCode',
  branchname: 'branchCode',
  debit: 'debit',
  withdrawal: 'debit',
  withdrawalamt: 'debit',
  withdrawalamount: 'debit',
  debitamount: 'debit',
  debitamt: 'debit',
  dr: 'debit',
  dramount: 'debit',
  debitinr: 'debit',
  debitrs: 'debit',
  withdrawaldr: 'debit',
  paidout: 'debit',
  outflow: 'debit',
  moneyout: 'debit',
  cashout: 'debit',
  fundsout: 'debit',
  spent: 'debit',
  amountdebited: 'debit',
  credit: 'credit',
  deposit: 'credit',
  depositamt: 'credit',
  depositamount: 'credit',
  creditamount: 'credit',
  creditamt: 'credit',
  cr: 'credit',
  cramount: 'credit',
  creditinr: 'credit',
  creditrs: 'credit',
  depositcr: 'credit',
  paidin: 'credit',
  inflow: 'credit',
  moneyin: 'credit',
  cashin: 'credit',
  fundsin: 'credit',
  received: 'credit',
  amountcredited: 'credit',
  amount: 'amount',
  txnamount: 'amount',
  transactionamount: 'amount',
  amt: 'amount',
  amountinr: 'amount',
  txnvalue: 'amount',
  drcr: 'drCr',
  crdr: 'drCr',
  debitcredit: 'drCr',
  drcrind: 'drCr',
  drcrindicator: 'drCr',
  indicator: 'drCr',
  balance: 'balance',
  closingbalance: 'balance',
  runningbalance: 'balance',
  availablebalance: 'balance',
  availbalance: 'balance',
  balanceinr: 'balance',
  closingbal: 'balance',
  balanceamt: 'balance',
  netbalance: 'balance',
  bal: 'balance',
  closingbalanceinr: 'balance',
  remarks: 'remarks',
  remark: 'remarks',
  usernote: 'remarks',
  usernotes: 'remarks',
  userremarks: 'remarks',
  banknote: 'remarks',
  comment: 'remarks',
  comments: 'remarks',
  note: 'remarks',
  notes: 'remarks',
  category: 'remarks',
  internalremarks: 'remarks',
  month: 'month',
  txnmonth: 'month',
  monthname: 'month',
  periodmonth: 'month',
  period: 'month',
  year: 'year',
  finyear: 'year',
  fy: 'year',
  financialyear: 'year',
  accountingyear: 'year',
  type: 'type',
  txntype: 'type',
  mode: 'type',
  paymentmode: 'type',
  channel: 'type',
  trantype: 'type',
  transactiontype: 'type'
};

const CANONICAL_DISPLAY_NAMES = {
  txnDate: 'Txn Date',
  valueDate: 'Value Date',
  description: 'Description',
  refNo: 'Ref No./Cheque No.',
  branchCode: 'Branch Code',
  debit: 'Debit',
  credit: 'Credit',
  amount: 'Amount',
  drCr: 'Dr / Cr',
  balance: 'Balance',
  remarks: 'Remarks',
  month: 'Month',
  year: 'Year',
  type: 'Type'
};

/**
 * Two-pass intelligent header matcher:
 * 1) Exact normalized match against HEADER_ALIASES (after stripping currency tags)
 * 2) Fuzzy keyword rule match for bank variations like "Money In", "Money Out", "Withdrawal Amt (INR)", etc.
 */
function matchHeaderToField(rawHeader) {
  const normFull = normalizeHeaderName(rawHeader);
  if (!normFull) return null;
  if (/^(sno|slno|srno|serialno|seqno|lineno|rowid|index)$/.test(normFull)) return null;
  if (HEADER_ALIASES[normFull]) return HEADER_ALIASES[normFull];

  // Strip trailing currency/unit words e.g. "(INR)", "(Rs.)", "(Rs)", "Amt in INR"
  const strippedRaw = String(rawHeader || '')
    .replace(/\((?:inr|rs\.?|₹|amount|dr|cr)[^)]*\)/gi, '')
    .replace(/\b(?:in\s+inr|in\s+rs\.?|inr)\b/gi, '');
  const normStripped = normalizeHeaderName(strippedRaw);
  if (normStripped && HEADER_ALIASES[normStripped]) return HEADER_ALIASES[normStripped];

  // Keyword rules (Pass 2)
  if (/^(?:dr\/?cr|cr\/?dr|debit\/?credit)/i.test(String(rawHeader || '').trim()) || (normFull.includes('drcr') || normFull.includes('crdr'))) {
    return 'drCr';
  }
  if (normFull.includes('withdrawal') || normFull.includes('moneyout') || normFull.includes('cashout') || normFull.includes('fundsout') || normFull.includes('outflow') || normFull.includes('paidout') || normFull === 'payment' || normFull === 'payments' || (normFull.includes('debit') && !normFull.includes('credit'))) {
    return 'debit';
  }
  if (normFull.includes('deposit') || normFull.includes('moneyin') || normFull.includes('cashin') || normFull.includes('fundsin') || normFull.includes('inflow') || normFull.includes('paidin') || normFull === 'receipt' || normFull === 'receipts' || (normFull.includes('credit') && !normFull.includes('debit'))) {
    return 'credit';
  }
  if (normFull.includes('balance') || normFull.startsWith('closbal')) {
    return 'balance';
  }
  if (normFull.includes('narration') || normFull.includes('particular') || normFull.includes('description')) {
    return 'description';
  }
  if (normFull.includes('cheque') || normFull.includes('chq') || normFull.includes('utr') || normFull.includes('referenceno') || normFull.includes('transactionref') || normFull.includes('refno') || normFull.includes('instrument')) {
    return 'refNo';
  }
  if (normFull.includes('valuedate') || normFull.includes('valdate') || normFull.includes('clearingdate') || normFull.includes('effectivedate')) {
    return 'valueDate';
  }
  if (normFull.includes('txndate') || normFull.includes('trandate') || normFull.includes('transdate') || normFull.includes('transactiondate') || normFull.includes('postingdate') || normFull.includes('bookdate') || normFull.includes('ledgerdate')) {
    return 'txnDate';
  }
  if (normFull.includes('branch') || normFull.includes('solid') || normFull === 'initbr') {
    return 'branchCode';
  }
  if (normFull.includes('remark') || normFull.includes('usernote')) {
    return 'remarks';
  }
  if (normFull.includes('txnamount') || normFull.includes('transactionamount')) {
    return 'amount';
  }
  return null;
}

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
 * Infer headerless columns from sample row values when user pastes rows without any header row.
 */
function inferHeaderlessMapping(sampleRows) {
  const maxCols = Math.max(...sampleRows.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
  if (maxCols < 4) return null;

  const isDateLike = (v) => {
    const s = String(v || '').trim();
    if (!s || /^\d+(\.\d+)?$/.test(s)) return false; // avoid treating plain integers like branch codes/amounts as Excel serial dates in heuristic scan
    return parseStatementDate(s).ok;
  };

  const isMoneyLike = (v) => {
    const s = String(v || '').trim();
    if (!s || /^\(?blank\)?$/i.test(s) || s === '-' || s === '--') return false;
    const p = parseAmountToPaise(s, { allowBlank: false, allowZero: true, allowNegative: true });
    return p.ok;
  };

  const colStats = [];
  for (let c = 0; c < maxCols; c++) {
    let nonBlank = 0;
    let dateCount = 0;
    let moneyCount = 0;
    let totalLen = 0;
    let decimalCount = 0;
    let branchLikeCount = 0;
    let fyLikeCount = 0;
    let monthLikeCount = 0;

    for (const row of sampleRows) {
      const val = String(row?.[c] ?? '').trim();
      if (!val || /^\(?blank\)?$/i.test(val)) continue;
      nonBlank++;
      totalLen += val.length;
      if (isDateLike(val)) dateCount++;
      if (isMoneyLike(val)) {
        moneyCount++;
        if (/\.\d{1,2}/.test(val) || val.includes(',')) decimalCount++;
        if (/^\d{1,5}$/.test(val)) branchLikeCount++;
      }
      if (/^\d{2}-\d{2}$/.test(val)) fyLikeCount++;
      if (MONTH_NAMES.some((m) => m.toLowerCase() === val.toLowerCase())) monthLikeCount++;
    }

    colStats.push({
      col: c,
      nonBlank,
      dateRatio: nonBlank ? dateCount / nonBlank : 0,
      moneyRatio: nonBlank ? moneyCount / nonBlank : 0,
      avgLen: nonBlank ? totalLen / nonBlank : 0,
      decimalCount,
      branchLikeCount,
      fyLikeCount,
      monthLikeCount
    });
  }

  const dateCols = colStats.filter((s) => s.nonBlank > 0 && s.dateRatio >= 0.6).map((s) => s.col);
  if (dateCols.length === 0) return null;

  // Classic 12-column fallback check (col 0 date, col 1 date, col 2 description, col 5 debit, col 6 credit, col 7 balance)
  const moneyCols = colStats.filter(
    (s) => !dateCols.includes(s.col) && s.nonBlank > 0 && s.moneyRatio >= 0.7 && (s.decimalCount > 0 || s.col >= 4)
  );
  // Distinguish branch code (short integer like "913" before monetary columns) from actual Debit/Credit/Balance
  const trueMoneyCols = moneyCols.filter((s) => !(s.branchLikeCount === s.nonBlank && s.decimalCount === 0 && moneyCols.length >= 3));

  const map = { txnDate: dateCols[0] };
  if (dateCols.length >= 2 && dateCols[1] !== dateCols[0]) {
    map.valueDate = dateCols[1];
  }

  // Pick description column as longest average text column not marked as date/money
  const textCols = colStats.filter(
    (s) =>
      !dateCols.includes(s.col) &&
      !trueMoneyCols.some((m) => m.col === s.col) &&
      s.nonBlank > 0 &&
      s.fyLikeCount === 0 &&
      s.monthLikeCount === 0
  );
  if (textCols.length > 0) {
    const descCol = [...textCols].sort((a, b) => b.avgLen - a.avgLen)[0];
    map.description = descCol.col;
  }

  // Remaining monetary columns -> [debit, credit, balance?]
  if (trueMoneyCols.length >= 2) {
    map.debit = trueMoneyCols[0].col;
    map.credit = trueMoneyCols[1].col;
    if (trueMoneyCols.length >= 3) {
      map.balance = trueMoneyCols[2].col;
    }
  } else if (trueMoneyCols.length === 1) {
    map.amount = trueMoneyCols[0].col;
  }

  const monthCol = colStats.find((s) => s.monthLikeCount > 0 && s.monthLikeCount === s.nonBlank);
  if (monthCol) map.month = monthCol.col;
  const fyCol = colStats.find((s) => s.fyLikeCount > 0 && s.fyLikeCount === s.nonBlank);
  if (fyCol) map.year = fyCol.col;

  const hasEnough = map.txnDate !== undefined && map.description !== undefined && ((map.debit !== undefined && map.credit !== undefined) || map.amount !== undefined);
  if (!hasEnough) return null;

  return {
    headerRowIndex: -1,
    colMap: map,
    headerLabels: Object.entries(map).reduce((acc, [k, idx]) => {
      acc[CANONICAL_DISPLAY_NAMES[k] || k] = `Column ${idx + 1} (Auto-detected)`;
      return acc;
    }, {}),
    detectionMode: 'headerless-inferred'
  };
}

/**
 * Deterministic Zero-AI Predictor:
 * Uses exact accounting math (prevBalance + Credit - Debit == currBalance) and statistical cell profiling
 * to predict any missing/unfamiliar statement columns (e.g. "Money In", "Money Out", "Col Out", "Dt1", etc.).
 */
function predictMissingColumnsFromRows(grid, headerRowIndex, colMap, headerLabels) {
  const sampleRows = grid
    .slice(headerRowIndex + 1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c || '').trim() !== ''))
    .slice(0, 25);

  if (sampleRows.length === 0) return { colMap, headerLabels, predictedAny: false };

  const headerRow = headerRowIndex >= 0 && Array.isArray(grid[headerRowIndex]) ? grid[headerRowIndex] : [];
  const maxCols = Math.max(headerRow.length, ...sampleRows.map((r) => r.length), 0);
  const nextMap = { ...colMap };
  const nextLabels = { ...headerLabels };
  const usedCols = new Set(Object.values(nextMap));
  let predictedAny = false;

  const markPredicted = (field, colIdx, note) => {
    nextMap[field] = colIdx;
    usedCols.add(colIdx);
    const hdr = String(headerRow[colIdx] ?? '').trim();
    nextLabels[CANONICAL_DISPLAY_NAMES[field] || field] = hdr
      ? `${hdr} (Predicted${note ? ` • ${note}` : ''})`
      : `Col ${colIdx + 1} (Predicted)`;
    predictedAny = true;
  };

  const isDateCell = (v) => {
    const s = String(v || '').trim();
    if (!s || /^\d+(\.\d+)?$/.test(s)) return false;
    return parseStatementDate(s).ok;
  };

  const parseMoneyCell = (v) => {
    const s = String(v || '').trim();
    if (!s || /^\(?blank\)?$/i.test(s) || s === '-' || s === '--') return null;
    const res = parseAmountToPaise(s, { allowBlank: false, allowZero: true, allowNegative: true });
    return res.ok ? res.paise : undefined;
  };

  const colStats = [];
  for (let c = 0; c < maxCols; c++) {
    let nonBlank = 0;
    let dateCount = 0;
    let moneyCount = 0;
    let invalidMoney = 0;
    let decOrComma = 0;
    let shortIntCount = 0;
    let monthCount = 0;
    let fyCount = 0;
    let refLikeCount = 0;
    let totalLen = 0;
    let narrationHint = 0;
    const distinctVals = new Set();

    for (const row of sampleRows) {
      const val = String(row?.[c] ?? '').trim();
      if (!val || /^\(?blank\)?$/i.test(val)) continue;
      nonBlank++;
      totalLen += val.length;
      distinctVals.add(val.toLowerCase());
      if (isDateCell(val)) dateCount++;
      const m = parseMoneyCell(val);
      if (m !== undefined && m !== null) {
        moneyCount++;
        if (/\.\d{1,2}/.test(val) || val.includes(',')) decOrComma++;
        if (/^\d{1,6}$/.test(val)) shortIntCount++;
      } else if (m === undefined) {
        invalidMoney++;
      }
      if (/^\d{2}-\d{2}$/.test(val)) fyCount++;
      if (MONTH_NAMES.some((mn) => mn.toLowerCase() === val.toLowerCase() || mn.slice(0, 3).toLowerCase() === val.toLowerCase())) {
        monthCount++;
      }
      if (/\b(UPI|NEFT|RTGS|IMPS|INB|TRANSFER|CHQ)\b/i.test(val)) narrationHint++;
      if (/\b([A-Z]{2,6}\d+[A-Z0-9]{4,}|\d{7,22})\b/i.test(val) || /TRANSFER\s+FROM/i.test(val)) refLikeCount++;
    }

    const hdrNorm = normalizeHeaderName(headerRow[c]);
    const isSerialHdr = /^(sno|slno|srno|serialno|seqno|lineno|rowid|index)$/.test(hdrNorm);
    const seqValues = sampleRows.map((r) => String(r?.[c] ?? '').trim()).filter(Boolean);
    const isSequential1N = seqValues.length >= 2 && seqValues.every((v, idx) => v === String(idx + 1));

    colStats.push({
      col: c,
      nonBlank,
      dateRatio: nonBlank ? dateCount / nonBlank : 0,
      isCleanMoneyCol: nonBlank > 0 && invalidMoney === 0 && moneyCount === nonBlank && !isSerialHdr && !isSequential1N && (decOrComma > 0 || nonBlank < sampleRows.length),
      isBlankCol: nonBlank === 0,
      isBranchLikeCol: nonBlank > 0 && invalidMoney === 0 && shortIntCount === nonBlank && decOrComma === 0 && !isSerialHdr && !isSequential1N,
      isSerialCol: isSerialHdr || isSequential1N,
      avgLen: nonBlank ? totalLen / nonBlank : 0,
      monthRatio: nonBlank ? monthCount / nonBlank : 0,
      fyRatio: nonBlank ? fyCount / nonBlank : 0,
      refLikeRatio: nonBlank ? refLikeCount / nonBlank : 0,
      narrationHint,
      uniqueCount: distinctVals.size
    });
  }

  // 1. Predict txnDate & valueDate if missing
  const unmappedDateCols = colStats
    .filter((s) => !usedCols.has(s.col) && s.nonBlank > 0 && s.dateRatio >= 0.6)
    .map((s) => s.col);

  if (nextMap.txnDate === undefined && unmappedDateCols.length > 0) {
    // If 2 date cols are unmapped, prefer chronological order or posting date vs effective date
    markPredicted('txnDate', unmappedDateCols[0], 'Date');
    if (nextMap.valueDate === undefined && unmappedDateCols.length >= 2) {
      markPredicted('valueDate', unmappedDateCols[1], 'Date');
    }
  } else if (nextMap.valueDate === undefined && unmappedDateCols.length > 0) {
    markPredicted('valueDate', unmappedDateCols[0], 'Date');
  }

  // 2. Predict description if missing
  if (nextMap.description === undefined) {
    const descCandidates = colStats
      .filter((s) => !usedCols.has(s.col) && s.nonBlank > 0 && s.dateRatio < 0.3 && !s.isCleanMoneyCol && !s.isBranchLikeCol && s.monthRatio < 0.5 && s.fyRatio < 0.5)
      .sort((a, b) => (b.narrationHint - a.narrationHint) || (b.avgLen - a.avgLen));
    if (descCandidates.length > 0) {
      markPredicted('description', descCandidates[0].col, 'Text');
    }
  }

  // 3. Predict debit, credit, balance via deterministic accounting identity (both Ascending & Descending order!)
  if (nextMap.debit === undefined || nextMap.credit === undefined) {
    const cleanMoneyCandidates = colStats
      .filter((s) => !usedCols.has(s.col) && s.isCleanMoneyCol)
      .map((s) => s.col);

    // Also include 100%-blank columns inside monetary region (e.g. an all-debit or all-credit slice)
    const minMoneyIdx = cleanMoneyCandidates.length > 0 ? Math.min(...cleanMoneyCandidates) : -1;
    const blankMoneyCandidates = minMoneyIdx >= 0
      ? colStats.filter((s) => !usedCols.has(s.col) && s.isBlankCol && Math.abs(s.col - minMoneyIdx) <= 2).map((s) => s.col)
      : [];

    const balCandidates = nextMap.balance !== undefined ? [nextMap.balance] : cleanMoneyCandidates;
    const flowCandidates = [
      ...(nextMap.debit !== undefined ? [nextMap.debit] : []),
      ...(nextMap.credit !== undefined ? [nextMap.credit] : []),
      ...cleanMoneyCandidates,
      ...blankMoneyCandidates
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    let bestTriple = null;
    let bestEqScore = -Infinity;

    if (flowCandidates.length >= 2 && balCandidates.length >= 1) {
      for (const bCol of balCandidates) {
        const bStat = colStats.find((s) => s.col === bCol);
        if (bStat && bStat.isBlankCol) continue;
        for (const drCol of flowCandidates) {
          if (drCol === bCol) continue;
          if (nextMap.debit !== undefined && drCol !== nextMap.debit) continue;
          for (const crCol of flowCandidates) {
            if (crCol === bCol || crCol === drCol) continue;
            if (nextMap.credit !== undefined && crCol !== nextMap.credit) continue;

            // Skip pairing two completely blank columns
            const drNonBlank = colStats.find((s) => s.col === drCol)?.nonBlank || 0;
            const crNonBlank = colStats.find((s) => s.col === crCol)?.nonBlank || 0;
            if (drNonBlank === 0 && crNonBlank === 0) continue;

            let ascMatches = 0;
            let ascMismatches = 0;
            let descMatches = 0;
            let descMismatches = 0;
            let bothNonZero = 0;

            for (let r = 1; r < sampleRows.length; r++) {
              const prevB = parseMoneyCell(sampleRows[r - 1]?.[bCol]);
              const currB = parseMoneyCell(sampleRows[r]?.[bCol]);
              const drCurr = parseMoneyCell(sampleRows[r]?.[drCol]) || 0;
              const crCurr = parseMoneyCell(sampleRows[r]?.[crCol]) || 0;
              const drPrev = parseMoneyCell(sampleRows[r - 1]?.[drCol]) || 0;
              const crPrev = parseMoneyCell(sampleRows[r - 1]?.[crCol]) || 0;
              if (drCurr > 0 && crCurr > 0) bothNonZero++;
              if (prevB !== null && prevB !== undefined && currB !== null && currB !== undefined) {
                if (prevB + crCurr - drCurr === currB) ascMatches++;
                else ascMismatches++;

                // Descending statement (newest row r-1 above older row r): prevB = currB + row[r-1].credit - row[r-1].debit
                if (currB + crPrev - drPrev === prevB) descMatches++;
                else descMismatches++;
              }
            }

            const ascScore = ascMatches > 0 ? (ascMatches * 4 - ascMismatches * 6 - bothNonZero * 10) : -Infinity;
            const descScore = descMatches > 0 ? (descMatches * 4 - descMismatches * 6 - bothNonZero * 10) : -Infinity;
            const eqScore = Math.max(ascScore, descScore);
            if (eqScore > bestEqScore) {
              bestEqScore = eqScore;
              bestTriple = { drCol, crCol, bCol };
            }
          }
        }
      }
    }

    if (bestTriple && bestEqScore > 0) {
      if (nextMap.debit === undefined) markPredicted('debit', bestTriple.drCol, 'Balance Math');
      if (nextMap.credit === undefined) markPredicted('credit', bestTriple.crCol, 'Balance Math');
      if (nextMap.balance === undefined) markPredicted('balance', bestTriple.bCol, 'Balance Math');
    } else if (nextMap.debit === undefined && nextMap.credit === undefined && flowCandidates.length >= 2 && nextMap.description !== undefined) {
      // Secondary rule when Balance column absent: match Credit cues ("BY TRANSFER", "/CR/", "Cr -") vs Debit cues ("TO TRANSFER", "/DR/")
      const [c1, c2] = flowCandidates;
      let c1CrScore = 0;
      let c2CrScore = 0;
      for (const row of sampleRows) {
        const descStr = String(row?.[nextMap.description] || '').toUpperCase();
        const isCrHint = descStr.includes('BY TRANSFER') || descStr.includes('/CR/') || descStr.includes('CR -');
        const isDrHint = descStr.includes('TO TRANSFER') || descStr.includes('/DR/') || descStr.includes('CHQ TRANSFER');
        const v1 = parseMoneyCell(row?.[c1]) || 0;
        const v2 = parseMoneyCell(row?.[c2]) || 0;
        if (v1 > 0 && v2 === 0) {
          if (isCrHint) c1CrScore++;
          if (isDrHint) c1CrScore--;
        } else if (v2 > 0 && v1 === 0) {
          if (isCrHint) c2CrScore++;
          if (isDrHint) c2CrScore--;
        }
      }
      if (c1CrScore >= c2CrScore) {
        markPredicted('credit', c1, 'Flow Cue');
        markPredicted('debit', c2, 'Flow Cue');
      } else {
        markPredicted('credit', c2, 'Flow Cue');
        markPredicted('debit', c1, 'Flow Cue');
      }
    }
  }

  // 4. Optional metadata prediction (month, year, branchCode, refNo, remarks, type)
  if (nextMap.month === undefined) {
    const mCol = colStats.find((s) => !usedCols.has(s.col) && s.monthRatio >= 0.6);
    if (mCol) markPredicted('month', mCol.col);
  }
  if (nextMap.year === undefined) {
    const yCol = colStats.find((s) => !usedCols.has(s.col) && s.fyRatio >= 0.6);
    if (yCol) markPredicted('year', yCol.col);
  }
  if (nextMap.branchCode === undefined) {
    const brCol = colStats.find((s) => !usedCols.has(s.col) && s.isBranchLikeCol);
    if (brCol) markPredicted('branchCode', brCol.col);
  }
  if (nextMap.refNo === undefined) {
    const rfCol = colStats.find((s) => !usedCols.has(s.col) && !s.isSerialCol && !s.isCleanMoneyCol && s.dateRatio < 0.3 && s.refLikeRatio >= 0.5);
    if (rfCol) markPredicted('refNo', rfCol.col);
  }
  if (nextMap.remarks === undefined) {
    const rmCol = colStats
      .filter((s) => !usedCols.has(s.col) && !s.isSerialCol && s.nonBlank > 0 && s.dateRatio < 0.3 && !s.isCleanMoneyCol && !s.isBranchLikeCol && s.monthRatio < 0.5 && s.fyRatio < 0.5 && s.uniqueCount >= 2)
      .sort((a, b) => b.avgLen - a.avgLen)[0];
    if (rmCol && rmCol.avgLen >= 4) markPredicted('remarks', rmCol.col);
  }
  if (nextMap.type === undefined) {
    const tpCol = colStats.find(
      (s) => !usedCols.has(s.col) && !s.isSerialCol && s.nonBlank > 0 && s.dateRatio < 0.2 && !s.isCleanMoneyCol && !s.isBranchLikeCol && s.avgLen <= 18 && s.uniqueCount <= 4
    );
    if (tpCol) markPredicted('type', tpCol.col);
  }

  return { colMap: nextMap, headerLabels: nextLabels, predictedAny };
}

/**
 * Find header row automatically and map column indices across bank formats & arbitrary column orders.
 */
function findHeaderRowAndMap(grid) {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error('No rows found in statement.');
  }

  let bestIdx = -1;
  let bestMap = {};
  let bestLabels = {};
  let bestScore = 0;

  const limit = Math.min(grid.length, 60);
  for (let r = 0; r < limit; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;

    const colMap = {};
    const headerLabels = {};
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const rawCell = String(row[c] ?? '').trim();
      const canonical = matchHeaderToField(rawCell);
      if (canonical && colMap[canonical] === undefined) {
        colMap[canonical] = c;
        headerLabels[CANONICAL_DISPLAY_NAMES[canonical] || canonical] = rawCell;
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
      bestMap = colMap;
      bestLabels = headerLabels;
    }

    // Stop early once core statement columns + extra metadata are confidently matched
    const hasCore = colMap.txnDate !== undefined && colMap.description !== undefined &&
      ((colMap.debit !== undefined && colMap.credit !== undefined) || colMap.amount !== undefined);
    if (hasCore && score >= 6) {
      break;
    }
  }

  // If NO header names matched, distinguish between (a) unknown-name header row vs (b) headerless data rows
  if (bestScore === 0 && grid.length >= 2 && Array.isArray(grid[0]) && grid[0].length >= 4) {
    const row0HasDatesOrAmounts = grid[0].some((cell) => {
      const s = String(cell || '').trim();
      if (!s) return false;
      if (!/^\d+(\.\d+)?$/.test(s) && parseStatementDate(s).ok) return true;
      const amt = parseAmountToPaise(s, { allowBlank: true, allowZero: false, allowNegative: true });
      return amt.ok && !amt.isBlank;
    });
    if (!row0HasDatesOrAmounts) {
      bestIdx = 0;
    }
  }

  // Headerless paste fallback when row 0 is already transaction data
  if (bestIdx === -1 && bestScore < 3 && grid[0] && grid[0].length >= 4) {
    const nonEmptySample = grid.filter((r) => Array.isArray(r) && r.some((c) => String(c || '').trim() !== '')).slice(0, 10);
    const inferred = inferHeaderlessMapping(nonEmptySample);
    if (inferred) return inferred;
  }

  // Run Zero-AI Mathematical + Statistical Predictor to fill any unmapped/unfamiliar columns!
  let usedPrediction = false;
  if (bestIdx >= 0) {
    const hasCoreAlready = bestMap.txnDate !== undefined && bestMap.description !== undefined &&
      ((bestMap.debit !== undefined && bestMap.credit !== undefined) || bestMap.amount !== undefined);
    if (!hasCoreAlready || bestMap.balance === undefined || bestMap.remarks === undefined) {
      const predicted = predictMissingColumnsFromRows(grid, bestIdx, bestMap, bestLabels);
      bestMap = predicted.colMap;
      bestLabels = predicted.headerLabels;
      usedPrediction = predicted.predictedAny;
    }
  }

  const hasSplitDrCr = bestMap.debit !== undefined && bestMap.credit !== undefined;
  const hasSingleAmount = bestMap.amount !== undefined && !hasSplitDrCr;

  const missing = [];
  if (bestMap.txnDate === undefined) missing.push('Txn Date');
  if (bestMap.description === undefined) missing.push('Description');
  if (!hasSplitDrCr && !hasSingleAmount) {
    if (bestMap.debit === undefined) missing.push('Debit');
    if (bestMap.credit === undefined) missing.push('Credit');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required statement column(s): ${missing.join(', ')}. Ensure header row contains Txn Date, Description, Debit, and Credit (or Amount + Dr/Cr).`);
  }

  return {
    headerRowIndex: bestIdx,
    colMap: bestMap,
    headerLabels: bestLabels,
    detectionMode: usedPrediction ? 'predicted' : (hasSingleAmount ? 'amount-drcr' : 'header-matched')
  };
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
 * Resolve Amount + Dr/Cr single-column statements into split Debit / Credit values
 */
function resolveSplitDebitCredit({ debitVal, creditVal, amountVal, drCrVal, typeVal }) {
  if (amountVal === undefined) {
    return { debit: debitVal, credit: creditVal };
  }
  const rawAmtStr = String(amountVal ?? '').trim();
  if (!rawAmtStr || /^\(?blank\)?$/i.test(rawAmtStr)) {
    return { debit: '', credit: '' };
  }
  const indicator = String(drCrVal || typeVal || '').trim().toUpperCase();
  const hasDrSuffix = /\bdr\.?$/i.test(rawAmtStr);
  const hasCrSuffix = /\bcr\.?$/i.test(rawAmtStr);

  if (hasDrSuffix || /^(dr|d|debit|wd|withdrawal)/i.test(indicator)) {
    return { debit: rawAmtStr.replace(/\s*(dr|cr)\.?$/i, ''), credit: '' };
  }
  if (hasCrSuffix || /^(cr|c|credit|dep|deposit)/i.test(indicator)) {
    return { debit: '', credit: rawAmtStr.replace(/\s*(dr|cr)\.?$/i, '') };
  }
  if (rawAmtStr.startsWith('-')) {
    return { debit: rawAmtStr.slice(1), credit: '' };
  }
  return { debit: '', credit: rawAmtStr };
}

/**
 * Parse grid into normalized preview rows + detected column mapping metadata.
 * Skips empty rows and repeated headers; preserves every invalid transaction row as Error.
 */
function parseGridWithMapping(grid, bankAccountId) {
  const { headerRowIndex, colMap, headerLabels, detectionMode } = findHeaderRowAndMap(grid);
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

    // Skip repeated header row inside multi-page exports (matches any header alias)
    const dateFieldMatch = matchHeaderToField(getCell('txnDate'));
    const descFieldMatch = matchHeaderToField(getCell('description'));
    if (dateFieldMatch === 'txnDate' && descFieldMatch === 'description') continue;

    const { debit, credit } = resolveSplitDebitCredit({
      debitVal: getCell('debit'),
      creditVal: getCell('credit'),
      amountVal: colMap.amount !== undefined && colMap.debit === undefined && colMap.credit === undefined ? getCell('amount') : undefined,
      drCrVal: getCell('drCr'),
      typeVal: getCell('type')
    });

    const rawObj = {
      txnDate: getCell('txnDate'),
      valueDate: getCell('valueDate'),
      description: getCell('description'),
      refNo: getCell('refNo'),
      branchCode: getCell('branchCode'),
      debit,
      credit,
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

  return {
    rows,
    mappingInfo: {
      headerRowNumber: headerRowIndex >= 0 ? headerRowIndex + 1 : 0,
      detectionMode,
      mappedHeaders: headerLabels || {}
    }
  };
}

/**
 * Parse grid into normalized preview rows (backwards-compatible wrapper)
 */
function parseGridToPreviewRows(grid, bankAccountId) {
  return parseGridWithMapping(grid, bankAccountId).rows;
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
  matchHeaderToField,
  parseFileBufferToGrid,
  parsePastedTextToGrid,
  findHeaderRowAndMap,
  normalizeAndValidateRow,
  parseGridWithMapping,
  parseGridToPreviewRows,
  evaluatePreviewState,
  resolvePresetDateRange,
  sanitizeSpreadsheetCell
};
