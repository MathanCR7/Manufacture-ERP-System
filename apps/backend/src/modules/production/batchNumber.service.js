const prisma = require('../../database/prisma');

/**
 * Service to generate auto batch numbers with strict concurrency locking:
 * Format: YYYYMMDD-PRODUCTCODE-NNNNN
 * Example: 20261013-CHILLI-00001
 */
class BatchNumberService {
  /**
   * Get active batch settings (resetMode, counterDigits, allowBackdated)
   */
  async getSettings(tx = prisma) {
    try {
      const rows = await tx.$queryRawUnsafe(`SELECT * FROM "batch_settings" WHERE id = 'DEFAULT' LIMIT 1`);
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (e) {
      console.warn('Could not read batch_settings, falling back to DAILY:', e.message);
    }
    return {
      reset_mode: 'DAILY',
      counter_digits: 5,
      allow_backdated_entries: true
    };
  }

  /**
   * Update batch numbering settings
   */
  async updateSettings(data, tx = prisma) {
    const resetMode = ['DAILY', 'MONTHLY', 'YEARLY', 'NEVER'].includes(data.resetMode?.toUpperCase())
      ? data.resetMode.toUpperCase()
      : 'DAILY';
    const counterDigits = Math.max(3, Math.min(10, parseInt(data.counterDigits, 10) || 5));
    const allowBackdated = data.allowBackdated !== undefined ? Boolean(data.allowBackdated) : true;

    await tx.$executeRawUnsafe(`
      INSERT INTO "batch_settings" ("id", "reset_mode", "counter_digits", "allow_backdated_entries", "updated_at")
      VALUES ('DEFAULT', $1, $2, $3, NOW())
      ON CONFLICT ("id")
      DO UPDATE SET
        "reset_mode" = $1,
        "counter_digits" = $2,
        "allow_backdated_entries" = $3,
        "updated_at" = NOW()
    `, resetMode, counterDigits, allowBackdated);

    return { resetMode, counterDigits, allowBackdated };
  }

  /**
   * Cleans product code: uppercase, alphanumeric only, max 10 chars.
   */
  sanitizeProductCode(product) {
    if (!product) return 'PRODUCT';
    const raw = product.code || product.name || 'PROD';
    // Remove all non-alphanumeric characters (spaces, hyphens, underscores, symbols)
    const cleaned = String(raw).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 10) || 'PROD';
  }

  /**
   * Formats the sequence key according to reset mode.
   * DAILY   => YYYYMMDD
   * MONTHLY => YYYYMM
   * YEARLY  => YYYY
   * NEVER   => ALL
   */
  buildSequenceKey(prodDate, resetMode) {
    const yyyy = prodDate.getFullYear().toString();
    const mm = String(prodDate.getMonth() + 1).padStart(2, '0');
    const dd = String(prodDate.getDate()).padStart(2, '0');

    switch (resetMode) {
      case 'MONTHLY':
        return `${yyyy}${mm}`;
      case 'YEARLY':
        return `${yyyy}`;
      case 'NEVER':
        return 'ALL';
      case 'DAILY':
      default:
        return `${yyyy}${mm}${dd}`;
    }
  }

  /**
   * Generate Next Batch Number atomically inside a transaction with row locking
   * @param {Object} tx - Prisma transaction client
   * @param {string} productId - FinishedProduct ID
   * @param {Date|string} productionDate - The production start date
   * @param {string} [overrideResetMode] - Optional reset mode override
   */
  async generateNextBatchNumber(tx, productId, productionDate, overrideResetMode = null) {
    if (!productId) {
      throw new Error('Product ID is required to generate batch number.');
    }

    // 1. Fetch Product details
    const product = await tx.finishedProduct.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true }
    });

    if (!product) {
      throw new Error(`Product not found for ID: ${productId}`);
    }

    const productCode = this.sanitizeProductCode(product);

    // 2. Determine production date formatting
    const prodDate = productionDate ? new Date(productionDate) : new Date();
    const yyyy = prodDate.getFullYear().toString();
    const mm = String(prodDate.getMonth() + 1).padStart(2, '0');
    const dd = String(prodDate.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    // 3. Determine reset mode and sequence key
    const settings = await this.getSettings(tx);
    const resetMode = (overrideResetMode || settings.reset_mode || 'DAILY').toUpperCase();
    const sequenceKey = this.buildSequenceKey(prodDate, resetMode);
    const counterDigits = settings.counter_digits || 5;

    // 4. ATOMIC CONCURRENCY: Row lock and increment sequence table using SELECT ... FOR UPDATE or Atomic Upsert
    // Step 4a: Lock row if exists or insert if absent
    const updateResult = await tx.$queryRawUnsafe(`
      INSERT INTO "batch_sequences" ("id", "product_id", "sequence_key", "reset_mode", "last_number", "updated_at")
      VALUES (gen_random_uuid(), $1, $2, $3, 1, NOW())
      ON CONFLICT ("product_id", "sequence_key")
      DO UPDATE SET
        "last_number" = "batch_sequences"."last_number" + 1,
        "updated_at" = NOW()
      RETURNING "last_number";
    `, productId, sequenceKey, resetMode);

    if (!updateResult || updateResult.length === 0) {
      throw new Error(`Failed to increment batch sequence for product ${productId}`);
    }

    const nextNumber = updateResult[0].last_number;
    const runningNumber = String(nextNumber).padStart(counterDigits, '0');

    // 5. Build final batch number: YYYYMMDD-PRODUCTCODE-NNNNN
    const batchNo = `${datePrefix}-${productCode}-${runningNumber}`;

    return {
      batchNo,
      productCode,
      datePrefix,
      runningNumber,
      sequenceKey,
      resetMode,
      counter: nextNumber
    };
  }

  /**
   * Preview what the next batch number would be without committing an increment.
   */
  async previewNextBatchNumber(productId, productionDate = new Date()) {
    const product = await prisma.finishedProduct.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true }
    });

    if (!product) return null;

    const productCode = this.sanitizeProductCode(product);
    const prodDate = new Date(productionDate);
    const yyyy = prodDate.getFullYear().toString();
    const mm = String(prodDate.getMonth() + 1).padStart(2, '0');
    const dd = String(prodDate.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    const settings = await this.getSettings(prisma);
    const resetMode = (settings.reset_mode || 'DAILY').toUpperCase();
    const sequenceKey = this.buildSequenceKey(prodDate, resetMode);
    const counterDigits = settings.counter_digits || 5;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT last_number FROM "batch_sequences" WHERE product_id = $1 AND sequence_key = $2 LIMIT 1`,
      productId,
      sequenceKey
    );

    const currentNumber = (existing && existing.length > 0) ? existing[0].last_number : 0;
    const nextNumber = currentNumber + 1;
    const runningNumber = String(nextNumber).padStart(counterDigits, '0');

    return {
      previewBatchNo: `${datePrefix}-${productCode}-${runningNumber}`,
      productCode,
      datePrefix,
      nextNumber,
      sequenceKey,
      resetMode
    };
  }
}

module.exports = new BatchNumberService();
