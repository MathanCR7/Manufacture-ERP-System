const prisma = require('../database/prisma');

/**
 * Atomic Document Number Series Service
 * Generates sequences with Month & Financial Year conforming to:
 * [PREFIX][RUNNING_NUMBER_4_DIGITS][START_YEAR_2_DIGITS][END_YEAR_2_DIGITS][MONTH_2_DIGITS]
 * E.g.:
 * - Sales Order: SO0003262711
 * - Quotation: QT0001262711
 * - Invoice: INV0002262711
 * - POS Receipt: POS0001262711
 * Allowing up to 9,999 documents per month per series.
 * Guarantees zero duplicate referenceNo / docNo even across soft-deleted records or manual inputs.
 */
class DocumentSeriesService {
  /**
   * Returns Indian Financial Year details and 2-digit month string
   * E.g. date in Nov 2026 -> startYearShort: "26", endYearShort: "27", month: "11", fy: "26-27"
   */
  getFinancialYear(date = new Date()) {
    const d = new Date(date);
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear(); // e.g. 2026

    let startYear, endYear;
    if (month >= 4) { // April onwards: April 2026 to Dec 2026 -> FY 2026-2027
      startYear = year;
      endYear = year + 1;
    } else { // Jan to March: Jan 2027 to March 2027 -> FY 2026-2027
      startYear = year - 1;
      endYear = year;
    }

    const startYearShort = String(startYear).slice(-2);
    const endYearShort = String(endYear).slice(-2);
    const fy = `${startYearShort}-${endYearShort}`;
    const monthStr = String(month).padStart(2, '0');
    return {
      fy,
      month: monthStr,
      startYearShort,
      endYearShort,
      fyCompact: `${startYearShort}${endYearShort}${monthStr}`,
      fyMonth: `${fy}/${monthStr}`
    };
  }

  /**
   * Map document types to standard prefixes
   */
  getPrefix(type) {
    const map = {
      'POS': 'POS',
      'INVOICE': 'INV',
      'Invoice': 'INV',
      'INV': 'INV',
      'QUOTATION': 'QT',
      'Quotation': 'QT',
      'QT': 'QT',
      'SALES_ORDER': 'SO',
      'Sales Order': 'SO',
      'STANDARD': 'SO',
      'Standard Order': 'SO',
      'SO': 'SO',
      'PL': 'PL',
      'PLANNING': 'PL',
      'Planning': 'PL',
      'NEED_PLANNING': 'PL',
      'Need Planning': 'PL',
      'DELIVERY_CHALLAN': 'DC',
      'Delivery Challan': 'DC',
      'DEBIT_NOTE': 'DN',
      'Debit Note': 'DN',
      'CREDIT_NOTE': 'CN',
      'Credit Note': 'CN',
    };
    return map[type] || 'DOC';
  }

  /**
   * Get all used sequence numbers for a given prefix and period from customerOrder
   * Handles both new format (e.g. SO0003262711) and legacy format (e.g. SO/26-27/11/0003)
   */
  async getUsedNumbers(prefix, fy, month, tx = prisma) {
    const [startYearShort, endYearShort] = fy.split('-');
    const newSuffix = `${startYearShort}${endYearShort}${month}`; // e.g. "262711"
    const legacyPrefix = `${prefix}/${fy}/${month}/`; // e.g. "SO/26-27/11/"

    const orders = await tx.customerOrder.findMany({
      where: {
        OR: [
          { docNo: { startsWith: prefix } },
          { referenceNo: { startsWith: prefix } }
        ]
      },
      select: { docNo: true, referenceNo: true }
    });

    const used = new Set();
    for (const ord of orders) {
      for (const val of [ord.docNo, ord.referenceNo]) {
        if (!val || typeof val !== 'string') continue;

        // 1. New format: e.g. SO0003262711 -> starts with prefix and ends with newSuffix (6 digits)
        if (val.startsWith(prefix) && val.endsWith(newSuffix)) {
          const middle = val.substring(prefix.length, val.length - newSuffix.length);
          const num = parseInt(middle, 10);
          if (!isNaN(num) && num > 0) {
            used.add(num);
          }
        }
        // 2. Legacy format: e.g. SO/26-27/11/0003
        else if (val.startsWith(legacyPrefix)) {
          const parts = val.split('/');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > 0) {
            used.add(num);
          }
        }
      }
    }
    return used;
  }

  /**
   * Generates next document number atomically within a transaction
   * Structure: {PREFIX}{XXXX}{START_YY}{END_YY}{MM} (e.g. SO0003262711, QT0001262711, INV0002262711)
   */
  async getNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, startYearShort, endYearShort, fyMonth } = this.getFinancialYear();
    const seriesType = prefix;

    const usedNumbers = await this.getUsedNumbers(prefix, fy, month, tx);

    const existingSeries = await tx.documentSeries.findUnique({
      where: {
        type_financialYear: {
          type: seriesType,
          financialYear: fyMonth,
        }
      }
    });

    let candidateNo = existingSeries ? (existingSeries.currentNo || 0) + 1 : 1;

    // Advance candidateNo until it finds an unused number in customerOrder
    while (usedNumbers.has(candidateNo)) {
      candidateNo++;
    }

    let series;
    if (existingSeries) {
      series = await tx.documentSeries.update({
        where: { id: existingSeries.id },
        data: { currentNo: candidateNo },
      });
    } else {
      series = await tx.documentSeries.create({
        data: {
          type: seriesType,
          prefix,
          financialYear: fyMonth,
          currentNo: candidateNo,
        }
      });
    }

    const formattedNo = String(candidateNo).padStart(4, '0');
    const docNo = `${prefix}${formattedNo}${startYearShort}${endYearShort}${month}`;

    return {
      docNo,
      prefix,
      financialYear: fyMonth,
      month,
      sequenceNo: candidateNo,
    };
  }

  /**
   * Preview next document number without incrementing sequence
   * Structure: {PREFIX}{XXXX}{START_YY}{END_YY}{MM} (e.g. SO0003262711, QT0001262711, INV0002262711)
   */
  async peekNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, startYearShort, endYearShort, fyMonth } = this.getFinancialYear();
    const seriesType = prefix;

    const usedNumbers = await this.getUsedNumbers(prefix, fy, month, tx);

    const series = await tx.documentSeries.findUnique({
      where: {
        type_financialYear: {
          type: seriesType,
          financialYear: fyMonth,
        }
      }
    });

    let nextSeq = series ? (series.currentNo || 0) + 1 : 1;
    while (usedNumbers.has(nextSeq)) {
      nextSeq++;
    }

    const formattedNo = String(nextSeq).padStart(4, '0');
    const docNo = `${prefix}${formattedNo}${startYearShort}${endYearShort}${month}`;

    return {
      docNo,
      prefix,
      financialYear: fyMonth,
      month,
      sequenceNo: nextSeq,
    };
  }

  /**
   * Synchronize documentSeries currentNo when a candidate document number is committed
   */
  async syncDocumentNumber(docNo, tx = prisma) {
    if (!docNo || typeof docNo !== 'string') return;

    // 1. Try matching new format: e.g. SO0003262711 (Prefix + 4 digits running + 2 digits start FY + 2 digits end FY + 2 digits month)
    const newMatch = docNo.match(/^([A-Za-z]+)(\d{4})(\d{2})(\d{2})(\d{2})$/);
    if (newMatch) {
      const [, rawPrefix, numStr, startYear, endYear, month] = newMatch;
      const prefix = rawPrefix.toUpperCase();
      const num = parseInt(numStr, 10);
      const fyMonth = `${startYear}-${endYear}/${month}`;
      if (!isNaN(num) && num > 0) {
        const existing = await tx.documentSeries.findUnique({
          where: {
            type_financialYear: {
              type: prefix,
              financialYear: fyMonth,
            }
          }
        });
        if (existing) {
          if (num > (existing.currentNo || 0)) {
            await tx.documentSeries.update({
              where: { id: existing.id },
              data: { currentNo: num }
            });
          }
        } else {
          await tx.documentSeries.create({
            data: {
              type: prefix,
              prefix,
              financialYear: fyMonth,
              currentNo: num
            }
          });
        }
      }
      return;
    }

    // 2. Try matching legacy format: e.g. SO/26-27/11/0003
    const parts = docNo.split('/');
    if (parts.length === 4) {
      const [prefix, fy, month, numStr] = parts;
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > 0) {
        const fyMonth = `${fy}/${month}`;
        const existing = await tx.documentSeries.findUnique({
          where: {
            type_financialYear: {
              type: prefix,
              financialYear: fyMonth,
            }
          }
        });
        if (existing) {
          if (num > (existing.currentNo || 0)) {
            await tx.documentSeries.update({
              where: { id: existing.id },
              data: { currentNo: num }
            });
          }
        } else {
          await tx.documentSeries.create({
            data: {
              type: prefix,
              prefix,
              financialYear: fyMonth,
              currentNo: num
            }
          });
        }
      }
    }
  }
}

module.exports = new DocumentSeriesService();
