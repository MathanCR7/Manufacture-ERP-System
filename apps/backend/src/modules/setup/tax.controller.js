const fs = require('fs');
const path = require('path');

const SETTINGS_FILE_PATH = path.join(__dirname, '../../database/tax_settings.json');

const DEFAULT_SETTINGS = {
  companyName: "Leonex",
  companyAddress: "O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Krishnapuram Extension, Shobha Nagar, West Krishnapuram, Ambattur, Chennai, Tamil Nadu 600053",
  companyGstin: "BCLNU556863412",
  companyMobile: "+91 9360163523",
  collectTax: "Yes",
  taxRegNo: "BCLNU556863412",
  taxType: "Exclusive Tax",
  taxes: [
    { name: "CGST", rate: "9.00" },
    { name: "SGST", rate: "9.00" },
    { name: "IGST", rate: "18.00" }
  ]
};

const getTaxSettingsData = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Tax Controller] Error reading settings file, using defaults:', err);
  }
  return DEFAULT_SETTINGS;
};

class TaxController {
  async getSettings(req, res, next) {
    try {
      const settings = getTaxSettingsData();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async saveSettings(req, res, next) {
    try {
      const settings = req.body;
      if (!settings.companyName || !settings.companyAddress || !settings.companyGstin) {
        return res.status(400).json({ error: 'Company Name, Address, and GSTIN are required fields.' });
      }

      // Ensure mobile field exists
      if (!settings.companyMobile) {
        settings.companyMobile = "+91 9360163523";
      }

      // Write to file
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
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
