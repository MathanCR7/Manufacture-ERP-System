const prisma = require('../../../database/prisma');
const { getTaxSettingsData } = require('../../setup/tax.controller');

/**
 * Formats a date into DDMMYY (day, month, last 2 digits of year), e.g. 121126.
 * Parses YYYY-MM-DD strings without UTC timezone offset shifts.
 */
function formatDDMMYY(dateInput = new Date()) {
  if (typeof dateInput === 'string') {
    const isoDate = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return `${isoDate[3]}${isoDate[2]}${isoDate[1].slice(-2)}`;
    }
    const dmy = dateInput.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})$/);
    if (dmy) {
      return `${dmy[1]}${dmy[2]}${dmy[3].slice(-2)}`;
    }
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  const dd = String(valid.getDate()).padStart(2, '0');
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  const yy = String(valid.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/**
 * Sanitizes company/product/code tokens into crisp uppercase alphanumeric strings.
 */
function sanitizeToken(raw, maxLen = 32, fallback = 'ITEM') {
  const cleaned = String(raw || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return (cleaned.slice(0, maxLen) || fallback);
}

/**
 * Builds per-product batch number:
 *   <EditableHeaderDDMMYY>-<PRODUCTNAME>-<DDMMYY>
 * Example: 121126-VANILLA-121126
 */
function formatProductBatchNo({ headerBatchCode, productName, dateInput = new Date() }) {
  const ddmmyy = formatDDMMYY(dateInput);
  const left = sanitizeToken(headerBatchCode || ddmmyy, 24, ddmmyy);
  const prod = sanitizeToken(productName || 'PRODUCT', 32, 'PRODUCT');
  return `${left}-${prod}-${ddmmyy}`;
}

/**
 * Builds 8-digit per-product serial number:
 *   <COMPANYNAME>-<PRODUCTNAME>-<00000001>
 * Example: LEONEX-VANILLA-00000001
 */
function formatProductSerialNo(companyName, productName, serialSeq) {
  const companyToken = sanitizeToken(companyName || 'COMPANY', 24, 'COMPANY');
  const productToken = sanitizeToken(productName || 'PRODUCT', 32, 'PRODUCT');
  const padded = String(Math.max(1, Number(serialSeq || 1))).padStart(8, '0');
  return `${companyToken}-${productToken}-${padded}`;
}

/**
 * Reads canonical company name from Tax Settings (deterministic company_details lookup).
 */
async function getCanonicalCompanyName() {
  try {
    const settings = await getTaxSettingsData();
    if (settings && settings.companyName) {
      return String(settings.companyName).trim();
    }
  } catch (err) {
    console.warn('[productionDaySerial] Tax settings fallback:', err.message);
  }
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT company_name FROM company_details ORDER BY updated_at DESC, id DESC LIMIT 1'
    );
    if (rows && rows.length > 0 && rows[0].company_name) {
      return String(rows[0].company_name).trim();
    }
  } catch (_) {
    // ignore
  }
  return 'LEONEX';
}

/**
 * Ensures product_serial_sequences table exists if called independently.
 */
async function ensureSerialTable(db = prisma) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_serial_sequences (
      product_id VARCHAR(64) PRIMARY KEY,
      product_name VARCHAR(255),
      last_serial BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Atomically allocates and persists the next 8-digit serial running number for a product
 * inside an active database transaction using row-level FOR UPDATE locking.
 */
async function assignNextProductSerial(tx, productId, productName = '', companyNameOverride = null) {
  const pid = String(productId || '').trim();
  if (!pid) {
    throw new Error('productId is required to assign a per-product serial number.');
  }

  let resolvedProductName = String(productName || '').trim();
  if (!resolvedProductName) {
    const prod = await tx.finishedProduct.findUnique({
      where: { id: pid },
      select: { name: true }
    });
    resolvedProductName = prod?.name || 'PRODUCT';
  }

  const companyName = companyNameOverride ? String(companyNameOverride).trim() : await getCanonicalCompanyName();

  await ensureSerialTable(tx);

  await tx.$executeRawUnsafe(`
    INSERT INTO product_serial_sequences (product_id, product_name, last_serial, updated_at)
    VALUES ($1, $2, 0, NOW())
    ON CONFLICT (product_id) DO NOTHING;
  `, pid, resolvedProductName);

  const lockedRows = await tx.$queryRawUnsafe(`
    SELECT last_serial FROM product_serial_sequences WHERE product_id = $1 FOR UPDATE;
  `, pid);

  const currentLast = lockedRows && lockedRows.length > 0 ? Number(lockedRows[0].last_serial || 0) : 0;
  const nextSeq = currentLast + 1;

  await tx.$executeRawUnsafe(`
    UPDATE product_serial_sequences
    SET last_serial = $2, product_name = COALESCE(NULLIF($3, ''), product_name), updated_at = NOW()
    WHERE product_id = $1;
  `, pid, nextSeq, resolvedProductName);

  const serialNo = formatProductSerialNo(companyName, resolvedProductName, nextSeq);

  return {
    productId: pid,
    productName: resolvedProductName,
    companyName,
    companyPrefix: sanitizeToken(companyName, 24, 'COMPANY'),
    serialSeq: nextSeq,
    serialNo
  };
}

/**
 * Resolves a collision-free per-product batch number within finished_product_stock_lots / day_outputs.
 */
async function ensureUniqueProductBatchNo(tx, candidateBatchNo, batchId, dayNo) {
  const base = String(candidateBatchNo || '').trim().toUpperCase();
  if (!base) return `${formatDDMMYY()}-PRODUCT-${formatDDMMYY()}`;

  try {
    const existing = await tx.$queryRawUnsafe(`
      SELECT product_batch_no FROM finished_product_stock_lots
      WHERE product_batch_no = $1
      LIMIT 1;
    `, base);
    if (!existing || existing.length === 0) {
      return base;
    }

    // Disambiguate safely when the exact same product is batched again on the same DDMMYY
    let suffixNum = Math.max(2, Number(dayNo || 2));
    while (suffixNum < 1000) {
      const candidate = `${base}-D${suffixNum}`;
      const check = await tx.$queryRawUnsafe(`
        SELECT product_batch_no FROM finished_product_stock_lots
        WHERE product_batch_no = $1
        LIMIT 1;
      `, candidate);
      if (!check || check.length === 0) {
        return candidate;
      }
      suffixNum++;
    }
  } catch (_) {
    // Table may not exist yet on first run before schema sync
  }
  return `${base}-D${Number(dayNo || 1)}-${Date.now().toString().slice(-3)}`;
}

/**
 * Non-mutating live preview of per-product batch codes & next 8-digit serial numbers
 * for display inside the Production Floor Cockpit before committing Day N.
 */
async function previewNextProductSerials(productIds = [], dateInput = new Date(), headerBatchCode = null) {
  const companyName = await getCanonicalCompanyName();
  const ddmmyy = formatDDMMYY(dateInput);
  const resolvedHeaderCode = sanitizeToken(headerBatchCode || ddmmyy, 24, ddmmyy);
  const companyPrefix = sanitizeToken(companyName, 24, 'COMPANY');

  const uniqueIds = [...new Set((Array.isArray(productIds) ? productIds : []).filter(Boolean).map(String))];
  const productsMap = {};

  if (uniqueIds.length > 0) {
    const dbProducts = await prisma.finishedProduct.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, code: true }
    });
    const nameMap = Object.fromEntries(dbProducts.map(p => [p.id, p]));

    let seqRows = [];
    try {
      await ensureSerialTable(prisma);
      seqRows = await prisma.$queryRawUnsafe(
        `SELECT product_id, last_serial FROM product_serial_sequences WHERE product_id = ANY($1::text[])`,
        uniqueIds
      );
    } catch (_) {
      seqRows = [];
    }
    const seqMap = Object.fromEntries(seqRows.map(r => [r.product_id, Number(r.last_serial || 0)]));

    for (const pid of uniqueIds) {
      const prod = nameMap[pid];
      const pName = prod?.name || 'PRODUCT';
      const nextSeq = (seqMap[pid] || 0) + 1;
      productsMap[pid] = {
        productId: pid,
        productName: pName,
        productCode: prod?.code || '',
        nextSerialSeq: nextSeq,
        serialNo: formatProductSerialNo(companyName, pName, nextSeq),
        defaultProductBatchNo: formatProductBatchNo({
          headerBatchCode: resolvedHeaderCode,
          productName: pName,
          dateInput
        })
      };
    }
  }

  return {
    companyName,
    companyPrefix,
    ddmmyy,
    headerBatchCode: resolvedHeaderCode,
    products: productsMap
  };
}

module.exports = {
  formatDDMMYY,
  sanitizeToken,
  formatProductBatchNo,
  formatProductSerialNo,
  getCanonicalCompanyName,
  ensureSerialTable,
  assignNextProductSerial,
  ensureUniqueProductBatchNo,
  previewNextProductSerials
};

