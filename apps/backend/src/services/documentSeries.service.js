const prisma = require('../database/prisma');

/**
 * Atomic Document Number Series Service
 * Generates sequences with Month & Financial Year, e.g.:
 * INV/26-27/10/0001, POS/26-27/10/0001, SO/26-27/10/0001, QT/26-27/10/0001
 * Allowing up to 9,999 documents per month per series.
 * Guarantees zero duplicate referenceNo / docNo even across soft-deleted records or manual inputs.
 */
class DocumentSeriesService {
  /**
   * Returns Indian Financial Year and 2-digit month string, e.g. fy: "26-27", month: "10"
   */
  getFinancialYear(date = new Date()) {
    const d = new Date(date);
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear(); // e.g. 2026

    let startYear, endYear;
    if (month >= 4) { // April onwards
      startYear = year;
      endYear = year + 1;
    } else {
      startYear = year - 1;
      endYear = year;
    }

    const fy = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
    const monthStr = String(month).padStart(2, '0');
    return {
      fy,
      month: monthStr,
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
   */
  async getUsedNumbers(prefix, fy, month, tx = prisma) {
    const periodPrefix = `${prefix}/${fy}/${month}/`;
    const orders = await tx.customerOrder.findMany({
      where: {
        OR: [
          { docNo: { startsWith: periodPrefix } },
          { referenceNo: { startsWith: periodPrefix } }
        ]
      },
      select: { docNo: true, referenceNo: true }
    });

    const used = new Set();
    for (const ord of orders) {
      for (const val of [ord.docNo, ord.referenceNo]) {
        if (val && typeof val === 'string' && val.startsWith(periodPrefix)) {
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
   * Structure: {PREFIX}/{FY}/{MONTH}/{XXXX} (e.g. INV/26-27/10/0001)
   */
  async getNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, fyMonth } = this.getFinancialYear();
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
    const docNo = `${prefix}/${fy}/${month}/${formattedNo}`;

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
   */
  async peekNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, fyMonth } = this.getFinancialYear();
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
    const docNo = `${prefix}/${fy}/${month}/${formattedNo}`;

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
