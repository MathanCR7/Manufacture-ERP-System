const prisma = require('../../database/prisma');

const DEFAULT_SETTINGS = {
  companyName: "Leonex pvt limited",
  companyAddress: "Factory / Registered Office Address",
  companyGstin: "33AABCL0702C1ZG",
  companyPan: "AABCL0702C",
  companyMobile: "+91 9360163523",
  collectTax: "Yes",
  taxRegNo: "33AABCL0702C1ZG",
  taxType: "Exclusive Tax",
  taxes: [
    { name: "CGST", rate: "9.00" },
    { name: "SGST", rate: "9.00" },
    { name: "IGST", rate: "18.00" }
  ]
};

const getTaxSettingsData = async () => {
  try {
    const details = await prisma.companyDetails.findFirst();
    if (details) {
      return {
        companyName: details.companyName,
        companyAddress: details.companyAddress,
        companyGstin: details.companyGstin,
        companyPan: details.companyPan,
        companyMobile: details.companyMobile,
        collectTax: "Yes",
        taxRegNo: details.companyGstin,
        taxType: "Exclusive Tax",
        taxes: [
          { name: "CGST", rate: "9.00" },
          { name: "SGST", rate: "9.00" },
          { name: "IGST", rate: "18.00" }
        ]
      };
    }
  } catch (err) {
    console.error('[Tax Controller] Error reading settings from DB, using defaults:', err);
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

      const mobile = companyMobile || "+91 9360163523";

      let existing = await prisma.companyDetails.findFirst();
      let updated;
      if (existing) {
        updated = await prisma.companyDetails.update({
          where: { id: existing.id },
          data: {
            companyName,
            companyAddress,
            companyGstin,
            companyPan,
            companyMobile: mobile
          }
        });
      } else {
        updated = await prisma.companyDetails.create({
          data: {
            companyName,
            companyAddress,
            companyGstin,
            companyPan,
            companyMobile: mobile
          }
        });
      }

      const settings = {
        companyName: updated.companyName,
        companyAddress: updated.companyAddress,
        companyGstin: updated.companyGstin,
        companyPan: updated.companyPan,
        companyMobile: updated.companyMobile,
        collectTax: "Yes",
        taxRegNo: updated.companyGstin,
        taxType: "Exclusive Tax",
        taxes: [
          { name: "CGST", rate: "9.00" },
          { name: "SGST", rate: "9.00" },
          { name: "IGST", rate: "18.00" }
        ]
      };

      res.json({ success: true, settings });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = {
  TaxController: new TaxController(),
  getTaxSettingsData
};
