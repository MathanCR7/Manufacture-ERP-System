/**
 * Utility to parse, analyze, and format production batch numbers
 * Standard format: PRODYYYYMMDD-XXXX (e.g. PROD20261021-0001)
 * Year: 2026, Month: 10, Day: 21, Seq: 0001
 */

export function analyzeProductionBatchNumber(batchStr, dateContext = null) {
  if (!batchStr || typeof batchStr !== 'string') {
    return {
      isValid: false,
      raw: batchStr || '',
      display: batchStr || '-'
    };
  }

  const trimmed = batchStr.trim();

  // Pattern 1: PROD + Year(4) + Month(2) + Day(2) + optional '-' + Sequence
  const prodMatch = trimmed.match(/^PROD(\d{4})(\d{2})(\d{2})(?:-(\d+)|\.(\d+)|_(\d+)|(\d{3,5}))?$/i);
  if (prodMatch) {
    const year = parseInt(prodMatch[1], 10);
    const month = parseInt(prodMatch[2], 10);
    const day = parseInt(prodMatch[3], 10);
    const seqStr = prodMatch[4] || prodMatch[5] || prodMatch[6] || prodMatch[7] || '1';
    const sequence = parseInt(seqStr, 10);
    const dateObj = new Date(year, month - 1, day);
    const isValidDate = !isNaN(dateObj.getTime()) && dateObj.getDate() === day;

    return {
      isValid: true,
      standardType: 'PROD_DATE_SEQUENCE',
      prefix: 'PROD',
      year,
      month,
      day,
      sequence,
      dateObj: isValidDate ? dateObj : null,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      sequenceFormatted: String(sequence).padStart(4, '0'),
      formattedBatchNo: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
      display: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
      isLegacy: false
    };
  }

  // Pattern 2: Legacy MP-XXXXXX (e.g. MP-000009) -> Standardize directly to PRODYYYYMMDD-XXXX
  const mpMatch = trimmed.match(/^MP-(\d+)$/i);
  if (mpMatch) {
    const seq = parseInt(mpMatch[1], 10);
    const d = dateContext ? new Date(dateContext) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const year = validDate.getFullYear();
    const month = validDate.getMonth() + 1;
    const day = validDate.getDate();

    return {
      isValid: true,
      standardType: 'LEGACY_CONVERTED',
      prefix: 'PROD',
      year,
      month,
      day,
      sequence: seq,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      sequenceFormatted: String(seq).padStart(4, '0'),
      formattedBatchNo: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(seq).padStart(4, '0')}`,
      display: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(seq).padStart(4, '0')}`,
      isLegacy: false
    };
  }

  return {
    isValid: false,
    standardType: 'CUSTOM',
    raw: trimmed,
    formattedBatchNo: trimmed,
    display: trimmed
  };
}

/**
 * Format batch reference for production start date
 */
export function formatNewBatchReference(dateVal = new Date(), sequence = 1) {
  const d = dateVal ? new Date(dateVal) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  const year = valid.getFullYear();
  const month = String(valid.getMonth() + 1).padStart(2, '0');
  const day = String(valid.getDate()).padStart(2, '0');
  return `PROD${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Formats date input into 6-char DDMMYY string (last 2 digits of year), e.g. 121126.
 */
export function formatDateToDDMMYY(dateVal = new Date()) {
  if (typeof dateVal === 'string') {
    const iso = dateVal.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[3]}${iso[2]}${iso[1].slice(-2)}`;
    }
    const dmy = dateVal.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})$/);
    if (dmy) {
      return `${dmy[1]}${dmy[2]}${dmy[3].slice(-2)}`;
    }
  }
  const d = dateVal ? new Date(dateVal) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  const dd = String(valid.getDate()).padStart(2, '0');
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  const yy = String(valid.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/**
 * Sanitizes uppercase alphanumeric token (company/product/batch code).
 */
export function sanitizeBatchToken(raw, maxLen = 32, fallback = 'ITEM') {
  const cleaned = String(raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, maxLen) || fallback;
}

/**
 * Parses a DDMMYY string into a readable date string DD/MM/YY.
 */
export function parseDDMMYY(code) {
  const m = String(code || '').trim().match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}/${m[2]}/20${m[3]}`;
}

/**
 * Builds per-product batch number:
 *   <EditableHeaderDDMMYY>-<PRODUCTNAME>-<DDMMYY>
 * Example: 121126-VANILLA-121126
 */
export function buildProductBatchNo(arg1, arg2, arg3) {
  let headerBatchCode;
  let productName;
  let dateVal;
  if (arg1 && typeof arg1 === 'object' && !(arg1 instanceof Date)) {
    ({ headerBatchCode, productName, dateVal = new Date() } = arg1);
  } else {
    headerBatchCode = arg1;
    productName = arg2;
    dateVal = arg3 || new Date();
  }
  const ddmmyy = formatDateToDDMMYY(dateVal);
  const left = sanitizeBatchToken(headerBatchCode || ddmmyy, 24, ddmmyy);
  const prod = sanitizeBatchToken(productName || 'PRODUCT', 32, 'PRODUCT');
  return `${left}-${prod}-${ddmmyy}`;
}

/**
 * Formats an 8-digit per-product serial preview:
 *   <COMPANY>-<PRODUCTNAME>-00000001
 */
export function formatProductSerialPreview(companyName, productName, seq = 1) {
  const company = sanitizeBatchToken(companyName || 'COMPANY', 24, 'COMPANY');
  const prod = sanitizeBatchToken(productName || 'PRODUCT', 32, 'PRODUCT');
  return `${company}-${prod}-${String(Math.max(1, Number(seq || 1))).padStart(8, '0')}`;
}
