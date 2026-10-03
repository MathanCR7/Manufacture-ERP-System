const prisma = require('../database/prisma');

/**
 * Atomic Document Number Series Service
 * Generates sequences like: INV/26-27/0001, POS/26-27/0001, QT/26-27/0001
 */
class DocumentSeriesService {
  /**
   * Returns Indian Financial Year string, e.g. "26-27"
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

    return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  }

  /**
   * Map document types to standard prefixes
   */
  getPrefix(type) {
    const map = {
      'POS': 'POS',
      'INVOICE': 'INV',
      'Invoice': 'INV',
      'QUOTATION': 'QT',
      'Quotation': 'QT',
      'SALES_ORDER': 'SO',
      'Sales Order': 'SO',
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
   * Generates next document number atomically within a transaction
   */
  async getNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const fy = this.getFinancialYear();
    const seriesType = prefix;

    const series = await tx.documentSeries.upsert({
      where: {
        type_financialYear: {
          type: seriesType,
          financialYear: fy,
        }
      },
      update: {
        currentNo: { increment: 1 },
      },
      create: {
        type: seriesType,
        prefix,
        financialYear: fy,
        currentNo: 1,
      }
    });

    const formattedNo = String(series.currentNo).padStart(4, '0');
    const docNo = `${prefix}/${fy}/${formattedNo}`;

    return {
      docNo,
      prefix,
      financialYear: fy,
      sequenceNo: series.currentNo,
    };
  }
}

module.exports = new DocumentSeriesService();
