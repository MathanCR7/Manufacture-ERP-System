const prisma = require('../../database/prisma');
const crypto = require('crypto');

const DEFAULT_SETTINGS = {
  companyName: '',
  companyAddress: '',
  companyGstin: '',
  companyPan: '',
  companyMobile: '',
  collectTax: 'Yes',
  taxRegNo: '',
  taxType: 'Exclusive Tax',
  taxes: [
    { name: 'CGST', rate: '9.00' },
    { name: 'SGST', rate: '9.00' },
    { name: 'IGST', rate: '18.00' }
  ]
};

const getTaxSettingsData = async () => {
  try {
    // 1. Try Prisma model if generated
    if (prisma.companyDetails) {
      try {
        const details = await prisma.companyDetails.findFirst({
          orderBy: { updatedAt: 'desc' }
        });
        if (details) {
          return {
            companyName: details.companyName || '',
            companyAddress: details.companyAddress || '',
            companyGstin: details.companyGstin || '',
            companyPan: details.companyPan || '',
            companyMobile: details.companyMobile || '',
            collectTax: 'Yes',
            taxRegNo: details.companyGstin || '',
            taxType: 'Exclusive Tax',
            taxes: [
              { name: 'CGST', rate: '9.00' },
              { name: 'SGST', rate: '9.00' },
              { name: 'IGST', rate: '18.00' }
            ]
          };
        }
      } catch (err) {
        // Fall through to queryRaw
      }
    }

    // 2. Direct PostgreSQL query fallback
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, company_name, company_address, company_gstin, company_pan, company_mobile FROM company_details ORDER BY updated_at DESC LIMIT 1'
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        companyName: r.company_name || '',
        companyAddress: r.company_address || '',
        companyGstin: r.company_gstin || '',
        companyPan: r.company_pan || '',
        companyMobile: r.company_mobile || '',
        collectTax: 'Yes',
        taxRegNo: r.company_gstin || '',
        taxType: 'Exclusive Tax',
        taxes: [
          { name: 'CGST', rate: '9.00' },
          { name: 'SGST', rate: '9.00' },
          { name: 'IGST', rate: '18.00' }
        ]
      };
    }
  } catch (err) {
    console.error('[Tax Controller] Error reading company details from Postgres:', err);
  }
  return DEFAULT_SETTINGS;
};

class TaxController {
  async getSettings(req, res, next) {
    try {
      const settings = await getTaxSettingsData();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async saveSettings(req, res, next) {
    try {
      const { companyName, companyAddress, companyGstin, companyPan, companyMobile } = req.body;
      if (!companyName || !companyAddress || !companyGstin || !companyPan) {
        return res.status(400).json({ error: 'Company Name, Address, GSTIN, and PAN are required fields.' });
      }

      const mobile = companyMobile || '';
      const name = companyName.trim();
      const address = companyAddress.trim();
      const gstin = companyGstin.trim();
      const pan = companyPan.trim();

      let savedRecord = null;

      // 1. Try Prisma model if available
      if (prisma.companyDetails) {
        try {
          const existing = await prisma.companyDetails.findFirst();
          if (existing) {
            savedRecord = await prisma.companyDetails.update({
              where: { id: existing.id },
              data: {
                companyName: name,
                companyAddress: address,
                companyGstin: gstin,
                companyPan: pan,
                companyMobile: mobile
              }
            });
          } else {
            savedRecord = await prisma.companyDetails.create({
              data: {
                companyName: name,
                companyAddress: address,
                companyGstin: gstin,
                companyPan: pan,
                companyMobile: mobile
              }
            });
          }
        } catch (pErr) {
          console.warn('[Tax Controller] Prisma model failed, using direct Postgres SQL:', pErr.message);
        }
      }

      // 2. Direct PostgreSQL query fallback
      if (!savedRecord) {
        const rows = await prisma.$queryRawUnsafe('SELECT id FROM company_details LIMIT 1');
        if (rows && rows.length > 0) {
          await prisma.$executeRawUnsafe(
            'UPDATE company_details SET company_name = $1, company_address = $2, company_gstin = $3, company_pan = $4, company_mobile = $5, updated_at = NOW() WHERE id = $6',
            name, address, gstin, pan, mobile, rows[0].id
          );
        } else {
          const newId = crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            'INSERT INTO company_details (id, company_name, company_address, company_gstin, company_pan, company_mobile, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
            newId, name, address, gstin, pan, mobile
          );
        }
      }

      const settings = {
        companyName: name,
        companyAddress: address,
        companyGstin: gstin,
        companyPan: pan,
        companyMobile: mobile,
        collectTax: 'Yes',
        taxRegNo: gstin,
        taxType: 'Exclusive Tax',
        taxes: [
          { name: 'CGST', rate: '9.00' },
          { name: 'SGST', rate: '9.00' },
          { name: 'IGST', rate: '18.00' }
        ]
      };

      res.json({ success: true, settings });
    } catch (error) {
      console.error('[Tax Controller] Error saving company details to Postgres:', error);
      next(error);
    }
  }
}

module.exports = {
  TaxController: new TaxController(),
  getTaxSettingsData
};
