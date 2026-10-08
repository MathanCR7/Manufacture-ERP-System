const prisma = require('../database/prisma');

/**
 * Atomic Document Number Series Service
 * Generates sequences with Month & Financial Year, e.g.:
 * INV/26-27/10/0001, POS/26-27/10/0001, SO/26-27/10/0001, QT/26-27/10/0001
 * Allowing up to 9,999 documents per month per series.
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
   * Generates next document number atomically within a transaction
   * Structure: {PREFIX}/{FY}/{MONTH}/{XXXX} (e.g. INV/26-27/10/0001)
   */
  async getNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, fyMonth } = this.getFinancialYear();
    const seriesType = prefix;

    const existingSeries = await tx.documentSeries.findUnique({
      where: {
        type_financialYear: {
          type: seriesType,
          financialYear: fyMonth,
        }
      }
    });

    let series;
    if (existingSeries) {
      series = await tx.documentSeries.update({
        where: { id: existingSeries.id },
        data: { currentNo: { increment: 1 } },
      });
    } else {
      // Find highest existing order number for this prefix in customer orders or old yearly series
      let highestNo = 0;

      const oldYearlySeries = await tx.documentSeries.findUnique({
        where: {
          type_financialYear: {
            type: seriesType,
            financialYear: fy,
          }
        }
      });
      if (oldYearlySeries) {
        highestNo = Math.max(highestNo, Number(oldYearlySeries.currentNo || 0));
      }

      const orders = await tx.customerOrder.findMany({
        where: {
          deletedAt: null,
          OR: [
            { docNo: { startsWith: `${prefix}/` } },
            { referenceNo: { startsWith: `${prefix}/` } }
          ]
        },
        select: { docNo: true, referenceNo: true }
      });

      for (const ord of orders) {
        const parts = (ord.docNo || ord.referenceNo || '').split('/');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > highestNo) {
          highestNo = num;
        }
      }

      const startingNo = highestNo + 1;
      series = await tx.documentSeries.create({
        data: {
          type: seriesType,
          prefix,
          financialYear: fyMonth,
          currentNo: startingNo,
        }
      });
    }

    const formattedNo = String(series.currentNo).padStart(4, '0');
    const docNo = `${prefix}/${fy}/${month}/${formattedNo}`;

    return {
      docNo,
      prefix,
      financialYear: fyMonth,
      month,
      sequenceNo: series.currentNo,
    };
  }

  /**
   * Preview next document number without incrementing sequence
   */
  async peekNextNumber(type, tx = prisma) {
    const prefix = this.getPrefix(type);
    const { fy, month, fyMonth } = this.getFinancialYear();
    const seriesType = prefix;

    const series = await tx.documentSeries.findUnique({
      where: {
        type_financialYear: {
          type: seriesType,
          financialYear: fyMonth,
        }
      }
    });

    let nextSeq = 1;
    if (series) {
      nextSeq = (series.currentNo || 0) + 1;
    } else {
      let highestNo = 0;
      const oldYearlySeries = await tx.documentSeries.findUnique({
        where: {
          type_financialYear: {
            type: seriesType,
            financialYear: fy,
          }
        }
      });
      if (oldYearlySeries) {
        highestNo = Math.max(highestNo, Number(oldYearlySeries.currentNo || 0));
      }

      const orders = await tx.customerOrder.findMany({
        where: {
          deletedAt: null,
          OR: [
            { docNo: { startsWith: `${prefix}/` } },
            { referenceNo: { startsWith: `${prefix}/` } }
          ]
        },
        select: { docNo: true, referenceNo: true }
      });

      for (const ord of orders) {
        const parts = (ord.docNo || ord.referenceNo || '').split('/');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > highestNo) {
          highestNo = num;
        }
      }
      nextSeq = highestNo + 1;
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
}

module.exports = new DocumentSeriesService();
