const prisma = require('../../database/prisma');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
  sendPRAutomatedEmail,
  sendPQAutomatedEmail,
  sendPOAutomatedEmail,
  sendAPInvoiceAutomatedEmail,
  sendGRPODiscrepancyNotice,
  sendPOUpdateDeleteNotice,
  sendAssetQuotationRequestEmail,
  sendAssetQuotationResponseAlert
} = require('../../utils/communication');
const { getTaxSettingsData } = require('../setup/tax.controller');

const hsnCodesPath = path.join(__dirname, '../../database/hsn_codes.json');
let hsnList = [];
try {
  if (fs.existsSync(hsnCodesPath)) {
    hsnList = JSON.parse(fs.readFileSync(hsnCodesPath, 'utf8'));
  }
} catch (err) {
  console.error('[Asset Service] Failed to load HSN codes database:', err);
}
const {
  triggerAssetPRCreated,
  triggerAssetPRApproved,
  triggerAssetPQCreated,
  triggerAssetPOCreated,
  triggerAssetGRPOCreated,
  triggerAssetAPInvoiceCreated,
  triggerAssetInvoicePaid,
  triggerAssetDecommissioned
} = require('../notifications/workflow.notifications');

const CATEGORY_MAP = {
  'IT Equipment': { hsn: '84713010', gst: 18, life: 3, rate: 31.67 },
  'Machinery & Plant': { hsn: '84220000', gst: 18, life: 15, rate: 6.33 },
  'Furniture & Fixtures': { hsn: '94030000', gst: 18, life: 10, rate: 9.50 },
  'Vehicles': { hsn: '87030000', gst: 28, life: 8, rate: 11.88 },
  'Infrastructure': { hsn: '73080000', gst: 18, life: 30, rate: 3.17 },
  'Office Equipment': { hsn: '84720000', gst: 18, life: 5, rate: 19.00 },
  'Intangible Assets': { hsn: '99730000', gst: 18, life: 3, rate: 31.67 }
};

// Indian number formatting to words helper
function numberToWordsIndian(num) {
  if (num === 0) return 'Zero Rupees';
  
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (digit === 0) return b[Math.floor(n / 10)];
    return b[Math.floor(n / 10)] + ' ' + a[digit];
  }

  function convert(n) {
    let str = '';
    if (n >= 10000000) {
      str += convert(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += convert(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += convert(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += numToWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      str += numToWords(n);
    }
    return str.trim();
  }

  const parts = Number(num).toFixed(2).split('.');
  const rupees = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1].substring(0, 2), 10) : 0;

  let words = convert(rupees) + ' Rupees';
  if (paise > 0) {
    words += ' and ' + convert(paise) + ' Paise';
  }
  return words + ' Only';
}

class AssetManagementService {
  // Global sequential running number formats: PREFIX-YYYY-MM-DD-SEQUENCE
  async getNextDocNumber(prefix) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    let lastNo = null;
    if (prefix === 'PR') {
      const lastDoc = await prisma.assetRequest.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      lastNo = lastDoc?.prNo;
    } else if (prefix === 'PQ') {
      const lastDoc = await prisma.assetPQ.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      lastNo = lastDoc?.pqNo;
    } else if (prefix === 'PO') {
      const lastDoc = await prisma.assetPO.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      lastNo = lastDoc?.poNo;
    } else if (prefix === 'GRPO') {
      const lastDoc = await prisma.assetGRPO.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      lastNo = lastDoc?.grpoNo;
    } else if (prefix === 'INV') {
      const lastDoc = await prisma.assetAPInvoice.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      lastNo = lastDoc?.invoiceNo;
    }

    let nextSeq = 1;
    if (lastNo) {
      const parts = lastNo.split('-');
      const lastSeqStr = parts[parts.length - 1];
      const parsed = parseInt(lastSeqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
    return `${prefix}-${yyyy}-${mm}-${dd}-${String(nextSeq).padStart(5, '0')}`;
  }

  async getNextAssetId() {
    const lastDoc = await prisma.asset.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    let nextSeq = 1;
    if (lastDoc?.assetId) {
      const parts = lastDoc.assetId.split('-');
      const lastSeqStr = parts[parts.length - 1];
      const parsed = parseInt(lastSeqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
    return `AST-${String(nextSeq).padStart(5, '0')}`;
  }

  // Seed Budgets
  async seedBudgets() {
    const count = await prisma.departmentBudget.count();
    if (count === 0) {
      const depts = [
        { dept: 'IT', allocated: 5000000 },
        { dept: 'Manufacturing', allocated: 20000000 },
        { dept: 'Admin', allocated: 2500000 },
        { dept: 'Logistics', allocated: 5000000 },
        { dept: 'Finance', allocated: 1000000 },
        { dept: 'HR', allocated: 500000 },
        { dept: 'Sales', allocated: 1000000 }
      ];

      for (const d of depts) {
        await prisma.departmentBudget.create({
          data: {
            department: d.dept,
            fiscalYear: '2026-27',
            allocated: d.allocated,
            utilized: 0,
            remaining: d.allocated
          }
        });
      }
    }
  }

  async getBudgets() {
    await this.seedBudgets();
    return prisma.departmentBudget.findMany();
  }

  async updateBudget(department, allocated) {
    const budget = await prisma.departmentBudget.findUnique({
      where: { department }
    });

    if (!budget) {
      return prisma.departmentBudget.create({
        data: {
          department,
          fiscalYear: '2026-27',
          allocated: Number(allocated),
          utilized: 0,
          remaining: Number(allocated)
        }
      });
    }

    const remaining = Number(allocated) - Number(budget.utilized);
    return prisma.departmentBudget.update({
      where: { department },
      data: {
        allocated: Number(allocated),
        remaining
      }
    });
  }

  // Master & Autocomplete Services
  async searchAssetMaster(search) {
    if (!search) {
      return prisma.assetMaster.findMany({
        take: 20,
        orderBy: { assetName: 'asc' }
      });
    }
    return prisma.assetMaster.findMany({
      where: {
        assetName: {
          contains: search,
          mode: 'insensitive'
        }
      },
      take: 20,
      orderBy: { assetName: 'asc' }
    });
  }

  async getAiHsnCode(name) {
    if (!name) throw new Error('Asset name is required for HSN lookup');
    const existing = await prisma.assetMaster.findFirst({
      where: {
        assetName: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });
    if (existing) {
      return {
        hsn: existing.hsnCode,
        description: existing.hsnDescription || '',
        category: existing.category,
        specifications: existing.specifications || '',
        lastUnitCost: existing.lastUnitCost ? Number(existing.lastUnitCost) : null,
        source: 'database'
      };
    }

    const liveRes = await this.lookupLiveHsn(name);
    return {
      hsn: liveRes.hsn,
      description: liveRes.description,
      source: 'live-database'
    };
  }

  async lookupLiveHsn(assetName) {
    const query = assetName.toLowerCase().trim();
    if (hsnList.length === 0) {
      return {
        hsn: '84713010',
        description: `Default HSN code for ${assetName} (Automatic data processing machines)`
      };
    }

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length === 0) {
      return {
        hsn: '84713010',
        description: `Default HSN code for ${assetName} (Automatic data processing machines)`
      };
    }

    // Filter first to speed up
    const candidates = hsnList.filter(item => {
      return queryWords.some(word => 
        item.description.toLowerCase().includes(word) ||
        (item.keywords && item.keywords.some(k => k.toLowerCase().includes(word)))
      );
    });

    if (candidates.length === 0) {
      return {
        hsn: '84713010',
        description: `Default HSN code for ${assetName} (Automatic data processing machines)`
      };
    }

    // Score candidates
    const getMatchScore = (item) => {
      const descLower = (item.description || '').toLowerCase();
      const descNormalized = descLower.replace(/[^a-z0-9\s]/g, ' ');
      const descWords = descNormalized.split(/\s+/).filter(w => w.length > 0);
      
      let score = 0;
      
      // 1. Exact description phrase match
      if (descLower.includes(query)) {
        score += 5000;
      } else if (descNormalized.includes(query)) {
        score += 4000;
      }
      
      // 2. Word matches in description
      let matchedDescWordsCount = 0;
      queryWords.forEach(qWord => {
        if (descWords.includes(qWord)) {
          score += 500;
          matchedDescWordsCount++;
        } else {
          // Partial prefix/stem match (e.g. "condition" in "conditioning")
          const hasPartial = descWords.some(dWord => {
            if (qWord.length >= 4 && dWord.length >= 4) {
              const minLen = Math.min(qWord.length, dWord.length);
              const prefixLen = Math.min(qWord.length, dWord.length, 4);
              return qWord.substring(0, prefixLen) === dWord.substring(0, prefixLen);
            }
            return dWord.includes(qWord) || qWord.includes(dWord);
          });
          if (hasPartial) {
            score += 200;
            matchedDescWordsCount++;
          }
        }
      });
      
      // Bonus if all query words matched in the description
      if (matchedDescWordsCount === queryWords.length) {
        score += 2000;
      }
      
      // 3. Chapter Name Match
      const chapterLower = (item.chapter_name || '').toLowerCase();
      if (chapterLower.includes(query)) {
        score += 100;
      }
      
      // 4. Keyword Match (much lower weight to avoid pollution)
      if (item.keywords && item.keywords.length > 0) {
        let keywordExactMatches = 0;
        let keywordPartialMatches = 0;
        
        item.keywords.forEach(kw => {
          const kwLower = kw.toLowerCase();
          if (kwLower === query) {
            keywordExactMatches++;
          } else if (kwLower.includes(query)) {
            keywordPartialMatches++;
          }
        });
        
        score += keywordExactMatches * 10;
        score += keywordPartialMatches * 2;
      }
      
      return score;
    };

    let bestMatch = null;
    let maxScore = -1;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const score = getMatchScore(item);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && maxScore > 0) {
      return {
        hsn: bestMatch.hsn_code,
        description: bestMatch.description
      };
    }

    return {
      hsn: '84713010',
      description: `Default HSN code for ${assetName} (Automatic data processing machines)`
    };
  }

  async createAssetMaster(data) {
    const existing = await prisma.assetMaster.findFirst({
      where: {
        assetName: {
          equals: data.assetName.trim(),
          mode: 'insensitive'
        }
      }
    });
    if (existing) {
      return prisma.assetMaster.update({
        where: { id: existing.id },
        data: {
          category: data.category,
          hsnCode: data.hsnCode,
          hsnDescription: data.hsnDescription || '',
          specifications: data.specifications || '',
          lastUnitCost: data.lastUnitCost ? Number(data.lastUnitCost) : null
        }
      });
    }
    return prisma.assetMaster.create({
      data: {
        assetName: data.assetName.trim(),
        category: data.category,
        hsnCode: data.hsnCode,
        hsnDescription: data.hsnDescription || '',
        specifications: data.specifications || '',
        lastUnitCost: data.lastUnitCost ? Number(data.lastUnitCost) : null
      }
    });
  }

  // PR Services
  async getPRs() {
    return prisma.assetRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPRById(id) {
    return prisma.assetRequest.findUnique({
      where: { id }
    });
  }

  async createPR(data, userId) {
    await this.seedBudgets();
    
    // Validation rules
    const reqDate = new Date();
    const reqByDate = new Date(data.requiredByDate);
    const diffTime = reqByDate - reqDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isUrgent = ['Urgent', 'Critical'].includes(data.priority);
    if (isUrgent && diffDays < 3) {
      throw new Error('Required By Date must be at least 3 days from Request Date for Urgent/Critical priority.');
    }
    if (!isUrgent && diffDays < 7) {
      throw new Error('Required By Date must be at least 7 days from Request Date for Normal/Low priority.');
    }

    if (!data.justification || data.justification.length < 20) {
      throw new Error('Business Justification is mandatory and must be at least 20 characters.');
    }

    // Extract items array
    let items = data.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      items = [{
        assetName: data.assetName,
        category: data.category,
        hsnCode: data.hsnCode || '84713010',
        hsnDescription: data.hsnDescription || '',
        specifications: data.specifications || '',
        quantity: parseInt(data.quantity, 10) || 1,
        estimatedUnitCost: Number(data.estimatedUnitCost) || 0
      }];
    }

    // Calculate total cost from all items
    let estimatedTotalCost = 0;
    items.forEach(item => {
      estimatedTotalCost += (parseInt(item.quantity, 10) || 0) * (Number(item.estimatedUnitCost) || 0);
    });

    // Duplicate Check: Same category and department in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let warning = null;

    for (const item of items) {
      const duplicates = await prisma.assetRequest.findFirst({
        where: {
          department: data.department,
          category: item.category,
          createdAt: { gte: thirtyDaysAgo }
        }
      });
      if (duplicates) {
        warning = `Warning: A duplicate asset request for ${item.category} in ${data.department} was raised in the last 30 days (${duplicates.prNo}).`;
        break;
      }
    }

    // Budget check
    const budget = await prisma.departmentBudget.findUnique({
      where: { department: data.department }
    });
    if (!budget || Number(budget.remaining) < estimatedTotalCost) {
      throw new Error(`Insufficient budget in Cost Center for ${data.department}. Remaining budget: ₹${budget ? Number(budget.remaining).toLocaleString('en-IN') : 0}`);
    }

    // Generate unique sequential document number
    const prNo = await this.getNextDocNumber('PR');

    // Save/update items in the master database permanently
    for (const item of items) {
      const cleanedName = item.assetName.trim();
      const existingMaster = await prisma.assetMaster.findFirst({
        where: {
          assetName: {
            equals: cleanedName,
            mode: 'insensitive'
          }
        }
      });
      const estUnitCost = Number(item.estimatedUnitCost) || 0;
      if (!existingMaster) {
        await prisma.assetMaster.create({
          data: {
            assetName: cleanedName,
            category: item.category,
            hsnCode: item.hsnCode || '84713010',
            hsnDescription: item.hsnDescription || '',
            specifications: item.specifications || '',
            lastUnitCost: estUnitCost
          }
        });
      } else {
        await prisma.assetMaster.update({
          where: { id: existingMaster.id },
          data: {
            lastUnitCost: estUnitCost,
            specifications: item.specifications || existingMaster.specifications
          }
        });
      }
    }

    // Backward compatibility: Set top-level fields using the first item's details
    const primaryItem = items[0];
    const newPR = await prisma.assetRequest.create({
      data: {
        prNo,
        requesterName: data.requesterName,
        requesterEmpId: data.requesterEmpId,
        department: data.department,
        costCenter: data.costCenter || `CC-${data.department}-001`,
        category: primaryItem.category,
        assetName: primaryItem.assetName,
        hsnCode: primaryItem.hsnCode || '84713010',
        hsnDescription: primaryItem.hsnDescription || '',
        specifications: primaryItem.specifications || '',
        quantity: parseInt(primaryItem.quantity, 10) || 1,
        estimatedUnitCost: Number(primaryItem.estimatedUnitCost) || 0,
        estimatedTotalCost,
        requiredByDate: reqByDate,
        priority: data.priority,
        justification: data.justification,
        preferredVendor: data.preferredVendor,
        attachments: data.attachments,
        status: 'Submitted',
        createdById: userId,
        items: items // Storing the full list array as JSON
      }
    });

    triggerAssetPRCreated({
      prNo: newPR.prNo,
      prId: newPR.id,
      assetName: primaryItem.assetName,
      department: data.department,
      category: primaryItem.category,
      quantity: parseInt(primaryItem.quantity, 10) || 1,
      estimatedTotalCost,
      priority: data.priority,
      requesterName: data.requesterName,
      actorId: userId,
      actorRole: 'PURCHASE_ACCOUNTANT'
    }).catch(err => console.error('Asset PR notification failed:', err.message));

    if (newPR.preferredVendor) {
      prisma.supplier.findFirst({
        where: { name: { equals: newPR.preferredVendor, mode: 'insensitive' } }
      }).then(supplier => {
        if (supplier) {
          sendPRAutomatedEmail(newPR, supplier);
        }
      }).catch(err => console.error('Failed to dispatch PR email:', err));
    }

    return { ...newPR, warning, document_type: 'Purchase Request', next_action: 'Create Purchase Quotation' };
  }

  async approvePR(id, approverName) {
    const pr = await prisma.assetRequest.findUnique({ where: { id } });
    if (!pr) throw new Error('PR not found');

    const cost = Number(pr.estimatedTotalCost);
    let level = 'L1';
    if (cost > 2500000) level = 'Board';
    else if (cost > 500000) level = 'CFO';
    else if (cost > 100000) level = 'GM';

    const updatedPR = await prisma.assetRequest.update({
      where: { id },
      data: {
        status: 'Approved',
        approverName,
        approverLevel: level
      }
    });

    triggerAssetPRApproved({
      prNo: pr.prNo,
      prId: pr.id,
      assetName: pr.assetName,
      department: pr.department,
      estimatedTotalCost: pr.estimatedTotalCost,
      approverName,
      approverLevel: level,
      actorId: updatedPR.createdById || 'system',
      actorRole: 'SUPERVISOR'
    }).catch(err => console.error('Asset PR approval notification failed:', err.message));

    return updatedPR;
  }

  // PQ Services
  async getPQs() {
    const pqs = await prisma.assetPQ.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    return pqs.map(mapPQToFrontend);
  }

  async getPQById(id) {
    const pq = await prisma.assetPQ.findUnique({
      where: { id },
      include: { items: true }
    });
    return mapPQToFrontend(pq);
  }

  async createPQ(data) {
    // Enforce "One Vendor per PR" rule (exempt if Cancelled)
    if (data.prNo && data.prNo !== 'Direct') {
      const existingVendorPQ = await prisma.assetPQ.findFirst({
        where: {
          prNo: data.prNo,
          vendorName: data.vendorName,
          status: { not: 'Cancelled' }
        }
      });
      if (existingVendorPQ) {
        throw new Error(`Vendor ${data.vendorName} has already submitted a quotation ${existingVendorPQ.pqNo} for PR ${data.prNo}. Each vendor is allowed only one quotation per PR. To revise, edit the existing quotation.`);
      }
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (data.vendorGstin && !gstinRegex.test(data.vendorGstin)) {
      throw new Error('Invalid GSTIN format. Must match 15-character standard: 99AAAAA9999A9Z9');
    }

    const validityTime = new Date(data.validityDate || data.validUntil) - new Date();
    const validityDays = Math.ceil(validityTime / (1000 * 60 * 60 * 24));
    if (validityDays < 15) {
      throw new Error('Quotation validity must be at least 15 days.');
    }

    const pqNo = await this.getNextDocNumber('PQ');

    let subtotal = 0;
    let taxAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;

    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || 'BCLNU556863412';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const stateCode = data.stateCode || (data.vendorGstin && data.vendorGstin.trim().length >= 2 ? data.vendorGstin.trim().substring(0, 2) : companyStateCode);
    const isIntrastate = stateCode === companyStateCode;

    const lineItemsData = [];
    const itemsList = data.items || [];

    for (const item of itemsList) {
      const quantity = parseInt(item.quantity, 10);
      const unitPrice = Number(item.unitPrice);
      const discountPercent = Number(item.discountPercent || 0);
      
      const discountedPrice = unitPrice * (1 - discountPercent / 100);
      const baseAmount = quantity * discountedPrice;
      const gstRate = Number(item.gstRate || 18);
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntrastate) {
        cgst = baseAmount * (gstRate / 2 / 100);
        sgst = baseAmount * (gstRate / 2 / 100);
      } else {
        igst = baseAmount * (gstRate / 100);
      }

      const lineTotal = baseAmount + cgst + sgst + igst;

      subtotal += quantity * unitPrice;
      totalDiscount += quantity * unitPrice * (discountPercent / 100);
      taxAmount += cgst + sgst + igst;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      lineItemsData.push({
        lineNo: item.lineNo || 1,
        itemCode: item.itemCode || 'AST-IT-001',
        description: item.description || item.itemDescription || '',
        category: item.category || 'IT Equipment',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        quantity,
        unitPrice,
        discountPercent,
        discountedPrice,
        baseAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        specMatch: item.specMatch || 'Yes',
        remarks: item.remarks || ''
      });
    }

    const shippingCharges = Number(data.shippingCharges || data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);
    const discountVal = Number(data.discount || 0) || totalDiscount;
    const applyGst = data.applyGst !== false;
    const isInterState = !isIntrastate;

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      if (!isIntrastate) {
        return Number(val) * 0.18; // Force 18% for IGST
      }
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(shippingCharges, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = totalCgst;
    let finalSgst = totalSgst;
    let finalIgst = totalIgst;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const finalTaxAmount = finalCgst + finalSgst + finalIgst;
    const tds = Number(data.tds || 0);
    const supplierQuoteRef = data.supplierQuoteRef || data.supplierQuotationRef || '';
    const preRoundTotal = subtotal - discountVal + finalTaxAmount + shippingCharges + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - tds;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    const pq = await prisma.assetPQ.create({
      data: {
        pqNo,
        validUntil: new Date(data.validityDate || data.validUntil || new Date(Date.now() + 15*24*60*60*1000)),
        prNo: data.prNo || 'Direct',
        vendorCode: data.vendorCode || `V-${String(Math.floor(Math.random()*9000)+1000)}`,
        vendorName: data.vendorName || '',
        vendorGstin: data.vendorGstin || 'N/A',
        vendorPan: data.vendorPan || (data.vendorGstin && data.vendorGstin.length >= 12 ? data.vendorGstin.substring(2, 12) : 'N/A'),
        contactPerson: data.contactPerson || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || data.vendorAddress || 'N/A',
        stateCode,
        currency: data.currency || 'INR',
        exchangeRate: data.exchangeRate || 1.00,
        paymentTerms: data.paymentTerms || 'Net 30',
        paymentMode: data.paymentMode || '',
        deliveryTerms: data.deliveryTerms || 'Door Delivery',
        leadTime: parseInt(data.leadTime, 10) || 7,
        warrantyPeriod: parseInt(data.warrantyPeriod, 10) || 12,
        amcAvailable: data.amcAvailable === true || data.amcAvailable === 'true',
        amcCost: Number(data.amcCost || 0),
        subtotal,
        discount: discountVal,
        cgst: finalCgst,
        sgst: finalSgst,
        igst: finalIgst,
        taxAmount: finalTaxAmount,
        shippingCharges,
        loadingCharges,
        unloadingCharges,
        packingCharges,
        insurance,
        otherCharges,
        chargeGstStates,
        applyGst,
        roundOff,
        grandTotal,
        tds,
        supplierQuoteRef,
        termsBlock: data.termsAndConditions || data.termsBlock || '',
        status: 'Received',
        items: {
          create: lineItemsData
        }
      },
      include: { items: true }
    });

    const mapped = mapPQToFrontend(pq);

    triggerAssetPQCreated({
      pqNo: pq.pqNo,
      pqId: pq.id,
      prNo: pq.prNo,
      vendorName: pq.vendorName,
      vendorGstin: pq.vendorGstin,
      grandTotal: pq.grandTotal,
      validUntil: pq.validUntil,
      actorId: data.actorId || 'system',
      actorRole: data.actorRole || 'PURCHASE_ACCOUNTANT'
    }).catch(err => console.error('Asset PQ notification failed:', err.message));

    prisma.supplier.findFirst({
      where: { name: { equals: pq.vendorName, mode: 'insensitive' } }
    }).then(supplier => {
      sendPQAutomatedEmail(pq, supplier);
    }).catch(err => console.error('Failed to dispatch PQ email:', err));

    return mapped;
  }

  async updatePQ(id, data) {
    const existing = await prisma.assetPQ.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('Quotation not found');

    const po = await prisma.assetPO.findFirst({
      where: { prNo: existing.prNo, status: { not: 'Cancelled' } }
    });
    if (po) {
      throw new Error('Cannot edit this Purchase Quotation because a Purchase Order has already been issued for this request.');
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (data.vendorGstin && !gstinRegex.test(data.vendorGstin)) {
      throw new Error('Invalid GSTIN format. Must match 15-character standard: 99AAAAA9999A9Z9');
    }

    const validityTime = new Date(data.validityDate || data.validUntil) - new Date();
    const validityDays = Math.ceil(validityTime / (1000 * 60 * 60 * 24));
    if (validityDays < 15) {
      throw new Error('Quotation validity must be at least 15 days.');
    }

    let subtotal = 0;
    let taxAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;

    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || 'BCLNU556863412';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const stateCode = data.stateCode || (data.vendorGstin && data.vendorGstin.trim().length >= 2 ? data.vendorGstin.trim().substring(0, 2) : companyStateCode);
    const isIntrastate = stateCode === companyStateCode;

    const lineItemsData = [];
    const itemsList = data.items || [];

    for (const item of itemsList) {
      const quantity = parseInt(item.quantity, 10);
      const unitPrice = Number(item.unitPrice);
      const discountPercent = Number(item.discountPercent || 0);
      
      const discountedPrice = unitPrice * (1 - discountPercent / 100);
      const baseAmount = quantity * discountedPrice;
      const gstRate = Number(item.gstRate || 18);
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntrastate) {
        cgst = baseAmount * (gstRate / 2 / 100);
        sgst = baseAmount * (gstRate / 2 / 100);
      } else {
        igst = baseAmount * (gstRate / 100);
      }

      const lineTotal = baseAmount + cgst + sgst + igst;

      subtotal += quantity * unitPrice;
      totalDiscount += quantity * unitPrice * (discountPercent / 100);
      taxAmount += cgst + sgst + igst;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      lineItemsData.push({
        lineNo: item.lineNo || 1,
        itemCode: item.itemCode || 'AST-IT-001',
        description: item.description || item.itemDescription || '',
        category: item.category || 'IT Equipment',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        quantity,
        unitPrice,
        discountPercent,
        discountedPrice,
        baseAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        specMatch: item.specMatch || 'Yes',
        remarks: item.remarks || ''
      });
    }

    const shippingCharges = Number(data.shippingCharges || data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);
    const discountVal = Number(data.discount || 0) || totalDiscount;
    const applyGst = data.applyGst !== false;
    const isInterState = !isIntrastate;

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      if (!isIntrastate) {
        return Number(val) * 0.18; // Force 18% for IGST
      }
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(shippingCharges, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = totalCgst;
    let finalSgst = totalSgst;
    let finalIgst = totalIgst;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const finalTaxAmount = finalCgst + finalSgst + finalIgst;
    const tds = Number(data.tds || 0);
    const supplierQuoteRef = data.supplierQuoteRef || data.supplierQuotationRef || '';
    const preRoundTotal = subtotal - discountVal + finalTaxAmount + shippingCharges + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - tds;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    // Delete old items
    await prisma.assetPQItem.deleteMany({
      where: { pqId: id }
    });

    const pq = await prisma.assetPQ.update({
      where: { id },
      data: {
        validUntil: new Date(data.validityDate || data.validUntil || new Date(Date.now() + 15*24*60*60*1000)),
        vendorGstin: data.vendorGstin || 'N/A',
        vendorPan: data.vendorPan || (data.vendorGstin && data.vendorGstin.length >= 12 ? data.vendorGstin.substring(2, 12) : 'N/A'),
        contactPerson: data.contactPerson || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || data.vendorAddress || 'N/A',
        stateCode,
        currency: data.currency || 'INR',
        exchangeRate: data.exchangeRate || 1.00,
        paymentTerms: data.paymentTerms || 'Net 30',
        paymentMode: data.paymentMode || '',
        deliveryTerms: data.deliveryTerms || 'Door Delivery',
        leadTime: parseInt(data.leadTime, 10) || 7,
        warrantyPeriod: parseInt(data.warrantyPeriod, 10) || 12,
        amcAvailable: data.amcAvailable === true || data.amcAvailable === 'true',
        amcCost: Number(data.amcCost || 0),
        subtotal,
        discount: discountVal,
        cgst: finalCgst,
        sgst: finalSgst,
        igst: finalIgst,
        taxAmount: finalTaxAmount,
        shippingCharges,
        loadingCharges,
        unloadingCharges,
        packingCharges,
        insurance,
        otherCharges,
        chargeGstStates,
        applyGst,
        roundOff,
        grandTotal,
        tds,
        supplierQuoteRef,
        termsBlock: data.termsAndConditions || data.termsBlock || '',
        items: {
          create: lineItemsData
        }
      },
      include: { items: true }
    });

    return mapPQToFrontend(pq);
  }

  async sendQuotationRequests(data, userId) {
    const { prNo, supplierIds, validityDate, validityTime, note } = data;
    if (!prNo) throw new Error('prNo is required');
    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
      throw new Error('Please select at least one supplier');
    }

    const pr = await prisma.assetRequest.findFirst({
      where: { prNo }
    });
    if (!pr) throw new Error(`PR ${prNo} not found`);

    // Parse validity date/time
    const validityAt = new Date(`${validityDate}T${validityTime || '18:00'}:00`);

    const crypto = require('crypto');
    const results = [];

    // PR items
    const prItems = Array.isArray(pr.items) ? pr.items : [];

    for (const supId of supplierIds) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supId }
      });
      if (!supplier) continue;

      // Check if they already have a quote request for this supplier/PR (unless cancelled)
      const existing = await prisma.assetPQ.findFirst({
        where: {
          prNo,
          vendorName: supplier.name,
          status: { not: 'Cancelled' }
        }
      });
      if (existing) {
        continue; // skip duplicate requests to the same supplier
      }

      // Generate a unique token
      const secureToken = crypto.randomBytes(32).toString('hex');
      // Generate a sequential PQ number
      const pqNo = await this.getNextDocNumber('PQ');

      // Create an AssetPQ record for each supplier in "Sent" status
      const pq = await prisma.assetPQ.create({
        data: {
          pqNo,
          validUntil: validityAt,
          prNo,
          vendorCode: supplier.code || `V-${String(Math.floor(Math.random()*9000)+1000)}`,
          vendorName: supplier.name,
          vendorGstin: supplier.gstin || 'N/A',
          vendorPan: supplier.pan || 'N/A',
          contactPerson: supplier.contactPerson || '',
          email: supplier.email || '',
          phone: supplier.phone || '',
          address: supplier.address || 'N/A',
          stateCode: supplier.stateCode || (supplier.gstin ? supplier.gstin.substring(0, 2) : '33'),
          currency: 'INR',
          exchangeRate: 1.00,
          paymentTerms: 'Net 30',
          paymentMode: '',
          deliveryTerms: 'Door Delivery',
          leadTime: 7,
          warrantyPeriod: 12,
          amcAvailable: false,
          amcCost: 0,
          subtotal: 0,
          discount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          taxAmount: 0,
          shippingCharges: 0,
          loadingCharges: 0,
          unloadingCharges: 0,
          packingCharges: 0,
          insurance: 0,
          otherCharges: 0,
          applyGst: true,
          roundOff: 0,
          grandTotal: 0,
          tds: 0,
          supplierQuoteRef: '',
          termsBlock: note || '',
          status: 'Sent',
          secureToken,
          items: {
            create: prItems.map((item, idx) => ({
              lineNo: idx + 1,
              itemCode: item.itemCode || `AST-IT-${idx+1}`,
              description: item.assetName || item.description || '',
              category: item.category || 'IT Equipment',
              hsnCode: item.hsnCode || '8471',
              uom: item.uom || 'Nos',
              quantity: parseInt(item.quantity, 10) || 1,
              unitPrice: 0,
              discountPercent: 0,
              discountedPrice: 0,
              baseAmount: 0,
              gstRate: 18,
              cgst: 0,
              sgst: 0,
              igst: 0,
              lineTotal: 0,
              specMatch: 'Yes',
              remarks: item.specifications || ''
            }))
          }
        },
        include: { items: true }
      });

      // Send the email link
      const publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
      const linkUrl = `${publicAppUrl}/asset-quote/${pq.id}/${secureToken}`;

      await sendAssetQuotationRequestEmail({
        quotation: pq,
        supplier,
        secureToken,
        linkUrl
      });

      results.push(mapPQToFrontend(pq));
    }

    return results;
  }

  async getPublicPQ(pqId, token) {
    const pq = await prisma.assetPQ.findFirst({
      where: {
        id: pqId,
        secureToken: token
      },
      include: {
        items: true
      }
    });

    if (!pq) {
      throw new Error('Invalid or expired quotation link');
    }

    const now = new Date();
    const isExpired = new Date(pq.validUntil) < now;

    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || '33AABCL0702C1ZG';

    return {
      quotation: mapPQToFrontend(pq),
      companyGstin,
      isExpired
    };
  }

  async submitPublicPQ(pqId, token, data) {
    const pq = await prisma.assetPQ.findFirst({
      where: {
        id: pqId,
        secureToken: token
      },
      include: {
        items: true
      }
    });

    if (!pq) {
      throw new Error('Invalid or expired quotation link');
    }

    const now = new Date();
    if (new Date(pq.validUntil) < now) {
      throw new Error('This quotation request has expired. Submissions are closed.');
    }

    const items = data.items || [];
    if (items.length === 0) {
      throw new Error('Price inputs for requested line items are required.');
    }

    // Recalculate totals
    let subtotal = 0;
    let taxAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;

    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || '33AABCL0702C1ZG';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const stateCode = data.stateCode || pq.stateCode || companyStateCode;
    const isIntrastate = stateCode === companyStateCode;

    const updatedItems = [];

    for (const item of items) {
      const dbItem = pq.items.find(i => i.id === item.id);
      if (!dbItem) continue;

      const quantity = parseInt(dbItem.quantity, 10) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountPercent = Number(item.discountPercent || 0);

      const discountedPrice = unitPrice * (1 - discountPercent / 100);
      const baseAmount = quantity * discountedPrice;
      const gstRate = Number(item.gstRate || 18);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntrastate) {
        cgst = baseAmount * (gstRate / 2 / 100);
        sgst = baseAmount * (gstRate / 2 / 100);
      } else {
        igst = baseAmount * (gstRate / 100);
      }

      const lineTotal = baseAmount + cgst + sgst + igst;

      subtotal += quantity * unitPrice;
      totalDiscount += quantity * unitPrice * (discountPercent / 100);
      taxAmount += cgst + sgst + igst;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      updatedItems.push({
        id: dbItem.id,
        unitPrice,
        discountPercent,
        discountedPrice,
        baseAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        specMatch: item.specMatch || 'Yes',
        remarks: item.remarks || ''
      });
    }

    const shippingCharges = Number(data.shippingCharges || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);
    const discountVal = Number(data.discount || 0) || totalDiscount;
    const applyGst = data.applyGst !== false;
    const isInterState = !isIntrastate;

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key];
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      if (isInterState) {
        return Number(val) * 0.18; // Force 18% for IGST
      }
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(shippingCharges, 'shippingCharges');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = totalCgst;
    let finalSgst = totalSgst;
    let finalIgst = totalIgst;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const finalTaxAmount = finalCgst + finalSgst + finalIgst;
    const tds = Number(data.tds || 0);
    const supplierQuoteRef = data.supplierQuoteRef || '';
    const preRoundTotal = subtotal - discountVal + finalTaxAmount + shippingCharges + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - tds;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    // Update the AssetPQ and its items inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update each AssetPQItem
      for (const item of updatedItems) {
        await tx.assetPQItem.update({
          where: { id: item.id },
          data: {
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountedPrice: item.discountedPrice,
            baseAmount: item.baseAmount,
            gstRate: item.gstRate,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            lineTotal: item.lineTotal,
            specMatch: item.specMatch,
            remarks: item.remarks
          }
        });
      }

      // Update AssetPQ header details
      return tx.assetPQ.update({
        where: { id: pq.id },
        data: {
          vendorGstin: data.vendorGstin || pq.vendorGstin || 'N/A',
          vendorPan: data.vendorPan || pq.vendorPan || 'N/A',
          contactPerson: data.contactPerson || pq.contactPerson || '',
          email: data.email || pq.email || '',
          phone: data.phone || pq.phone || '',
          address: data.address || pq.address || 'N/A',
          stateCode,
          currency: data.currency || 'INR',
          paymentTerms: data.paymentTerms || 'Net 30',
          paymentMode: data.paymentMode || '',
          deliveryTerms: data.deliveryTerms || 'Door Delivery',
          leadTime: parseInt(data.leadTime, 10) || 7,
          warrantyPeriod: parseInt(data.warrantyPeriod, 10) || 12,
          amcAvailable: data.amcAvailable === true || data.amcAvailable === 'true',
          amcCost: Number(data.amcCost || 0),
          subtotal,
          discount: discountVal,
          cgst: finalCgst,
          sgst: finalSgst,
          igst: finalIgst,
          taxAmount: finalTaxAmount,
          shippingCharges,
          loadingCharges,
          unloadingCharges,
          packingCharges,
          insurance,
          otherCharges,
          chargeGstStates,
          applyGst,
          roundOff,
          grandTotal,
          tds,
          supplierQuoteRef,
          termsBlock: data.termsAndConditions || data.termsBlock || pq.termsBlock || '',
          bankName: data.bankName || null,
          bankAccountHolder: data.bankAccountHolder || null,
          bankAccountNo: data.bankAccountNo || null,
          bankIfsc: data.bankIfsc || null,
          bankBranch: data.bankBranch || null,
          bankUpi: data.bankUpi || null,
          status: 'Received'
        },
        include: { items: true }
      });
    });

    // Alert internal team and confirm to supplier
    await sendAssetQuotationResponseAlert({
      quotation: result,
      supplierName: result.vendorName,
      supplierEmail: result.email,
      grandTotal: result.grandTotal,
      expiryAt: result.validUntil
    });

    return mapPQToFrontend(result);
  }

  async requestResubmission(pqId, token) {
    const pq = await prisma.assetPQ.findFirst({
      where: {
        id: pqId,
        secureToken: token
      }
    });

    if (!pq) {
      throw new Error('Invalid quotation link');
    }

    return prisma.assetPQ.update({
      where: { id: pq.id },
      data: { status: 'Resubmission Requested' }
    });
  }

  async resendSupplierLink(pqId) {
    const pq = await prisma.assetPQ.findUnique({
      where: { id: pqId },
      include: { items: true }
    });

    if (!pq) {
      throw new Error('Quotation not found');
    }

    if (pq.status === 'PO Issued') {
      throw new Error('Cannot resend access link for a quotation that has already been converted into a Purchase Order.');
    }

    // Reset status to 'Sent' so supplier can submit again
    const updatedPq = await prisma.assetPQ.update({
      where: { id: pqId },
      data: {
        status: 'Sent'
      },
      include: { items: true }
    });

    const supplier = await prisma.supplier.findFirst({
      where: { name: { equals: pq.vendorName, mode: 'insensitive' } }
    });

    if (!supplier) {
      throw new Error(`Supplier profile not found for ${pq.vendorName}`);
    }

    const publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const linkUrl = `${publicAppUrl}/asset-quote/${updatedPq.id}/${updatedPq.secureToken}`;

    // Send resubmission approval email
    await sendAssetQuotationRequestEmail({
      quotation: updatedPq,
      supplier,
      secureToken: updatedPq.secureToken,
      linkUrl
    });

    return updatedPq;
  }

  async getPQComparison(prNo) {
    const quotations = await prisma.assetPQ.findMany({
      where: { prNo },
      include: { items: true }
    });

    if (quotations.length === 0) return { quotations: [], recommendedVendorId: null, recommendationReason: 'No quotations found' };

    const scoredQuotes = quotations.map(q => {
      const amcAddition = q.amcAvailable ? Number(q.amcCost) * 3 : 0;
      const tco = Number(q.grandTotal) + amcAddition;
      return { ...q, tco };
    });

    scoredQuotes.sort((a, b) => a.tco - b.tco);

    const recommended = scoredQuotes[0];
    let note = '';
    const isL1 = recommended.grandTotal === Math.min(...quotations.map(q => Number(q.grandTotal)));

    if (isL1) {
      note = `Vendor ${recommended.vendorName} is recommended because they offer the lowest Total Cost of Ownership (TCO) of ₹${recommended.tco.toLocaleString('en-IN')}.`;
    } else {
      note = `Vendor ${recommended.vendorName} is recommended because of technical superiority and/or warranty terms, despite not being the absolute L1 vendor.`;
    }

    const maxTotal = Math.max(...quotations.map(q => Number(q.grandTotal)));
    let warning = null;
    if (maxTotal > 2500000 && quotations.length < 5) {
      warning = `Warning: Procurement rules require a minimum of 5 vendor quotations for values exceeding ₹25,00,000. Currently registered: ${quotations.length}.`;
    } else if (maxTotal > 500000 && quotations.length < 3) {
      warning = `Warning: Procurement rules require a minimum of 3 vendor quotations for values exceeding ₹5,00,000. Currently registered: ${quotations.length}.`;
    }

    return {
      quotations: scoredQuotes.map(mapPQToFrontend),
      recommendedVendorId: recommended.id,
      recommendationReason: note,
      warning
    };
  }

  // PO Services
  async getPOs() {
    const pos = await prisma.assetPO.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    const suppliers = await prisma.supplier.findMany({
      select: { name: true, signatureImage: true, companySealImage: true }
    });
    return pos.map(po => {
      const mapped = mapPOToFrontend(po);
      if (mapped) {
        const supplier = suppliers.find(s => s.name.toLowerCase() === po.vendorName.toLowerCase());
        mapped.supplier = supplier || null;
      }
      return mapped;
    });
  }

  async getPOById(id) {
    const po = await prisma.assetPO.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!po) return null;
    const supplier = await prisma.supplier.findFirst({
      where: { name: { equals: po.vendorName, mode: 'insensitive' } },
      select: { signatureImage: true, companySealImage: true }
    });
    const mapped = mapPOToFrontend(po);
    if (mapped) {
      mapped.supplier = supplier || null;
    }
    return mapped;
  }

  async createPO(data, userId) {
    await this.seedBudgets();

    let pqNo = data.pqNo || null;
    let prNo = data.prNo;
    let prDepartment = null;
    let prCostCenter = null;
    let resolvedVendorCode = data.vendorCode;
    let resolvedVendorName = data.vendorName;
    let resolvedVendorGstin = data.vendorGstin;
    let resolvedVendorPan = data.vendorPan;
    let resolvedVendorAddress = data.vendorAddress || data.address;

    // If prId is provided, look up the PR directly (Direct PR → PO flow, no PQ needed)
    if (data.prId) {
      const pr = await prisma.assetRequest.findUnique({ where: { id: data.prId } });
      if (pr) {
        prNo = pr.prNo;
        prDepartment = pr.department;
        prCostCenter = pr.costCenter;
      }
    }

    let tds = Number(data.tds || 0);
    let supplierQuoteRef = data.supplierQuoteRef || data.supplierQuotationRef || '';

    let termsBlock = data.termsAndConditions || data.termsBlock || null;

    // If pqId is provided (legacy PQ → PO flow), look up from PQ
    if (data.pqId) {
      const pq = await prisma.assetPQ.findUnique({ where: { id: data.pqId } });
      if (pq) {
        pqNo = pq.pqNo;
        if (!prNo) prNo = pq.prNo;
        resolvedVendorCode = resolvedVendorCode || pq.vendorCode;
        resolvedVendorName = resolvedVendorName || pq.vendorName;
        resolvedVendorGstin = resolvedVendorGstin || pq.vendorGstin;
        resolvedVendorPan = resolvedVendorPan || pq.vendorPan;
        resolvedVendorAddress = resolvedVendorAddress || pq.address;
        tds = Number(pq.tds || 0);
        supplierQuoteRef = pq.supplierQuoteRef || '';
        termsBlock = termsBlock || pq.termsBlock;
        
        data.bankName = data.bankName || pq.bankName;
        data.bankAccountHolder = data.bankAccountHolder || pq.bankAccountHolder;
        data.bankAccountNo = data.bankAccountNo || pq.bankAccountNo;
        data.bankIfsc = data.bankIfsc || pq.bankIfsc;
        data.bankBranch = data.bankBranch || pq.bankBranch;
        data.bankUpi = data.bankUpi || pq.bankUpi;
      }
    }

    // Single PO per PR constraint validation
    if (prNo && prNo !== 'Direct') {
      const existingPO = await prisma.assetPO.findFirst({
        where: {
          prNo,
          status: { not: 'Cancelled' }
        }
      });
      if (existingPO) {
        throw new Error(`A Purchase Order (${existingPO.poNo}) has already been raised for PR ${prNo}. Each PR is allowed only one Purchase Order.`);
      }
    }

    const costCenter = prCostCenter || data.costCenter || (prDepartment ? `CC-${prDepartment}-001` : 'CC-IT-001');
    const deptCode = prDepartment || costCenter.replace('CC-', '').split('-')[0] || 'IT';

    const budget = await prisma.departmentBudget.findUnique({
      where: { department: deptCode }
    });

    const applyGst = data.applyGst !== false;
    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || '33AABCL0702C1ZG';
    const companyPan = taxSettings?.companyPan || (companyGstin.length >= 12 ? companyGstin.substring(2, 12) : 'BCLNU55686');
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const vendorGstin = resolvedVendorGstin || data.vendorGstin || '';
    const vendorStateCode = vendorGstin.trim().substring(0, 2);
    const isInterState = vendorStateCode && companyStateCode ? (vendorStateCode !== companyStateCode) : (data.isInterState === true);

    const poItems = (data.items || []).map((item, idx) => {
      const orderedQty = parseInt(item.quantity || item.orderedQty || 1, 10);
      const unitPrice = Number(item.unitPrice || 0);
      const discountPercent = Number(item.discountPercent || 0);
      const baseAmount = Number(item.totalBeforeTax || item.baseAmount || (orderedQty * unitPrice * (1 - discountPercent/100)));
      const gstRate = Number(item.gstRate || 18);
      const gstAmount = applyGst ? Number(item.gstAmount || (baseAmount * gstRate / 100)) : 0;
      const lineTotal = Number(item.totalWithGst || item.lineTotal || (baseAmount + gstAmount));

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (applyGst) {
        if (isInterState) {
          igst = gstAmount;
        } else {
          cgst = gstAmount / 2;
          sgst = gstAmount / 2;
        }
      }

      return {
        lineNo: item.lineNo || (idx + 1),
        itemCode: item.itemCode || `AST-${deptCode}-${idx + 1}`,
        description: item.itemDescription || item.description || '',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        orderedQty,
        receivedQty: 0,
        pendingQty: orderedQty,
        unitPrice,
        discountPercent,
        baseAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        targetDeliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        remarks: item.remarks || ''
      };
    });

    const subtotal = poItems.reduce((s, i) => s + i.baseAmount, 0);
    const cgstTotal = poItems.reduce((s, i) => s + i.cgst, 0);
    const sgstTotal = poItems.reduce((s, i) => s + i.sgst, 0);
    const igstTotal = poItems.reduce((s, i) => s + i.igst, 0);

    const freight = Number(data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);
    const discountTotal = Number(data.discount || 0);

    // Dynamic tax calculation on charges based on chargeGstStates
    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      if (isInterState) {
        return Number(val) * 0.18; // Force 18% for IGST
      }
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(freight, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = cgstTotal;
    let finalSgst = sgstTotal;
    let finalIgst = igstTotal;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const taxAmount = finalCgst + finalSgst + finalIgst;
    const preRoundTotal = subtotal + taxAmount + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discountTotal - tds;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    let budgetStatus = 'OK';
    if (budget) {
      const remaining = Number(budget.remaining);
      const allocated = Number(budget.allocated);
      const utilized = Number(budget.utilized);
      if (grandTotal > remaining) {
        throw new Error(`PO creation blocked. Remaining department budget (₹${remaining.toLocaleString('en-IN')}) is insufficient for ₹${grandTotal.toLocaleString('en-IN')}.`);
      }
      
      const totalPlannedUtilized = utilized + grandTotal;
      if (totalPlannedUtilized / allocated >= 0.9) {
        budgetStatus = 'WARNING';
      }
    }

    const poNo = await this.getNextDocNumber('PO');

    // Multi-level approval setup based on PO value
    let approvalLevel = 'L1';
    let approverName = 'Department Head';
    if (grandTotal > 2500000) {
      approvalLevel = 'Board';
      approverName = 'Board / MD';
    } else if (grandTotal > 500000) {
      approvalLevel = 'L3';
      approverName = 'CFO';
    } else if (grandTotal > 100000) {
      approvalLevel = 'L2';
      approverName = 'General Manager';
    }
    if (grandTotal > 1000000) {
      approverName = `${approverName} & Finance Controller (Countersigned)`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.assetPO.create({
        data: {
          poNo,
          poType: data.poType || 'Standard',
          pqNo,
          prNo,
          vendorCode: resolvedVendorCode || `V-${String(Math.floor(Math.random()*9000)+1000)}`,
          vendorName: resolvedVendorName || '',
          vendorGstin: resolvedVendorGstin || '',
          vendorPan: resolvedVendorPan || '',
          address: resolvedVendorAddress || '',
          shipTo: data.deliveryAddress || data.shipTo || 'Central Warehouse, Mumbai',
          billTo: data.billTo || 'Corporate HQ, Mumbai',
          companyGstin: companyGstin,
          companyPan: companyPan,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
          paymentTerms: data.paymentTerms || 'Net 30',
          paymentMode: data.paymentMode || '',
          paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate) : new Date(new Date().setDate(new Date().getDate() + 30)),
          incoterms: data.incoterms || 'DDP',
          placeOfSupply: data.placeOfSupply || '27',
          purchaseType: 'Asset Capitalization',
          glAccount: data.glAccount || '120100',
          costCenter,
          projectCode: data.projectCode || '',
          status: 'Approved',
          approverName,
          approvalLevel,
          termsBlock: termsBlock || 'Standard Terms & Conditions Apply.',
          subtotal,
          discount: discountTotal,
          freight,
          loadingCharges,
          unloadingCharges,
          packingCharges,
          insurance,
          isInterState,
          applyGst,
          chargeGstStates: chargeGstStates,
          cgst: finalCgst,
          sgst: finalSgst,
          igst: finalIgst,
          taxAmount,
          shippingCharges: freight,
          otherCharges,
          roundOff,
          grandTotal,
          tds,
          supplierQuoteRef,
          bankName: data.bankName || null,
          bankAccountHolder: data.bankAccountHolder || null,
          bankAccountNo: data.bankAccountNo || null,
          bankIfsc: data.bankIfsc || null,
          bankBranch: data.bankBranch || null,
          bankUpi: data.bankUpi || null,
          createdById: userId,
          items: {
            create: poItems
          }
        },
        include: { items: true }
      });

      // Update budget utilized
      if (budget) {
        await tx.departmentBudget.update({
          where: { id: budget.id },
          data: {
            utilized: { increment: grandTotal },
            remaining: { decrement: grandTotal }
          }
        });
      }

      // Mark Quotation as PO Issued
      if (pqNo) {
        await tx.assetPQ.updateMany({
          where: { pqNo },
          data: { status: 'PO Issued' }
        });
      }

      // Mark PR as PO Issued / Closed
      if (prNo) {
        await tx.assetRequest.updateMany({
          where: { prNo },
          data: { status: 'PO Issued' }
        });
      }

      return po;
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    const supplier = await prisma.supplier.findFirst({
      where: { name: { equals: result.vendorName, mode: 'insensitive' } },
      select: { name: true, signatureImage: true, companySealImage: true }
    });

    const poResponse = {
      ...mapPOToFrontend(result),
      supplier: supplier || null,
      budget_check: {
        allocated: budget ? Number(budget.allocated) : 0,
        utilized: budget ? Number(budget.utilized) + grandTotal : 0,
        remaining: budget ? Number(budget.remaining) - grandTotal : 0,
        status: budgetStatus
      },
      document_type: 'Purchase Order',
      next_action: 'Goods Receipt PO on delivery'
    };

    triggerAssetPOCreated({
      poNo: result.poNo,
      poId: result.id,
      prNo: result.prNo,
      pqNo: result.pqNo,
      vendorName: result.vendorName,
      vendorGstin: result.vendorGstin,
      grandTotal,
      deliveryDate: result.deliveryDate,
      department: deptCode,
      actorName: data.actorName || 'User',
      actorId: userId || 'system',
      actorRole: 'PURCHASE_ACCOUNTANT'
    }).catch(err => console.error('Asset PO notification failed:', err.message));

    prisma.supplier.findFirst({
      where: { name: { equals: result.vendorName, mode: 'insensitive' } }
    }).then(supplier => {
      sendPOAutomatedEmail(result, supplier);
    }).catch(err => console.error('Failed to dispatch PO email:', err));

    return poResponse;
  }

  // GRPO Services
  async getGRPOs() {
    const grpos = await prisma.assetGRPO.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    const mappedGrpos = [];
    for (const grpo of grpos) {
      const po = await prisma.assetPO.findUnique({
        where: { poNo: grpo.poNo },
        include: { items: true }
      });
      const items = grpo.items?.map(item => {
        const poLine = po?.items?.find(pi => pi.lineNo === item.poLineRef || pi.description === item.description);
        return {
          ...item,
          unitPrice: poLine ? Number(poLine.unitPrice) : 0,
          gstRate: poLine ? Number(poLine.gstRate) : 18,
          hsnCode: poLine ? poLine.hsnCode : ''
        };
      }) || [];
      mappedGrpos.push({
        ...grpo,
        items
      });
    }
    return mappedGrpos.map(mapGRPOToFrontend);
  }

  async createGRPO(data) {
    const grpoNo = await this.getNextDocNumber('GRPO');

    let po;
    if (data.poId) {
      po = await prisma.assetPO.findUnique({
        where: { id: data.poId },
        include: { items: true }
      });
    } else if (data.poNo) {
      po = await prisma.assetPO.findUnique({
        where: { poNo: data.poNo },
        include: { items: true }
      });
    }
    if (!po) throw new Error('Reference PO not found');

    const itemsToCreate = (data.items || []).map((item, idx) => ({
      poLineRef: item.poLineRef || (idx + 1),
      description: item.itemDescription || item.description || '',
      orderedQty: Number(item.poQuantity || item.orderedQty || 0),
      receivedQty: Number(item.receivedQuantity || item.receivedQty || 0),
      acceptedQty: Number(item.acceptedQuantity || item.acceptedQty || 0),
      rejectedQty: Number(item.rejectedQuantity || item.rejectedQty || 0),
      rejectionReason: item.rejectionReason || item.inspectionRemarks || '',
      condition: item.condition || 'Good',
      serialNo: item.serialNo || '',
      assetTag: item.assetTag || item.assetTagNo || '',
      remarks: item.inspectionRemarks || item.remarks || ''
    }));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create GRPO Record
      const grpo = await tx.assetGRPO.create({
        data: {
          grpoNo,
          poNo: po.poNo,
          vendorCode: po.vendorCode,
          vendorName: po.vendorName,
          challanNo: data.challanNo || data.deliveryNoteNo || '',
          transporter: data.transporter || '',
          vehicleNo: data.vehicleNo || '',
          receivedBy: data.receivedBy || '',
          receivedById: data.receivedById || 'SYSTEM',
          location: data.receivingLocation || data.location || 'Warehouse',
          qcStatus: data.qcStatus || 'Passed',
          qcInspector: data.qcInspector || data.receivedBy || '',
          items: {
            create: itemsToCreate
          }
        },
        include: { items: true }
      });

      // 2. Update PO line quantities and status
      let allFullyReceived = true;
      for (const line of itemsToCreate) {
        const poLine = po.items.find(pi => pi.lineNo === line.poLineRef);
        if (poLine) {
          const updatedReceived = Number(poLine.receivedQty) + Number(line.receivedQty);
          const updatedPending = Math.max(0, Number(poLine.orderedQty) - updatedReceived);
          
          if (updatedPending > 0) {
            allFullyReceived = false;
          }

          await tx.assetPOItem.update({
            where: { id: poLine.id },
            data: {
              receivedQty: updatedReceived,
              pendingQty: updatedPending
            }
          });
        }
      }

      await tx.assetPO.update({
        where: { id: po.id },
        data: {
          status: allFullyReceived ? 'Closed' : 'Partially Received'
        }
      });

      // 3. Asset Capitalization (Create AST records for accepted items)
      const lastDoc = await tx.asset.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      let nextSeq = 1;
      if (lastDoc?.assetId) {
        const parts = lastDoc.assetId.split('-');
        const lastSeqStr = parts[parts.length - 1];
        const parsed = parseInt(lastSeqStr, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }

      for (const line of itemsToCreate) {
        const accepted = parseInt(line.acceptedQty, 10);
        if (accepted > 0) {
          const poLine = po.items.find(pi => pi.lineNo === line.poLineRef);
          const itemPrice = poLine ? Number(poLine.unitPrice) : 50000;
          
          // Classify Category for Companies Act 2013 Useful Life & Rate
          let category = 'IT Equipment';
          if (poLine?.description?.toLowerCase().includes('chair') || poLine?.description?.toLowerCase().includes('desk') || poLine?.description?.toLowerCase().includes('furniture')) {
            category = 'Furniture & Fixtures';
          } else if (poLine?.description?.toLowerCase().includes('machine') || poLine?.description?.toLowerCase().includes('cnc') || poLine?.description?.toLowerCase().includes('drill')) {
            category = 'Machinery & Plant';
          } else if (poLine?.description?.toLowerCase().includes('car') || poLine?.description?.toLowerCase().includes('truck') || poLine?.description?.toLowerCase().includes('forklift')) {
            category = 'Vehicles';
          } else if (poLine?.description?.toLowerCase().includes('ac') || poLine?.description?.toLowerCase().includes('air conditioner') || poLine?.description?.toLowerCase().includes('ups') || poLine?.description?.toLowerCase().includes('generator')) {
            category = 'Office Equipment';
          } else if (poLine?.description?.toLowerCase().includes('structure') || poLine?.description?.toLowerCase().includes('electrical')) {
            category = 'Infrastructure';
          } else if (poLine?.description?.toLowerCase().includes('software') || poLine?.description?.toLowerCase().includes('license')) {
            category = 'Intangible Assets';
          }

          const mapDetails = CATEGORY_MAP[category] || { life: 5, rate: 20.00 };
          const usefulLife = mapDetails.life;
          const depRate = mapDetails.rate;

          const capitalizedCost = itemPrice; 
          const salvageValue = capitalizedCost * 0.05;
          const annualDep = (capitalizedCost - salvageValue) * (depRate / 100);
          const monthlyDep = annualDep / 12;

          for (let i = 0; i < accepted; i++) {
            const assetId = `AST-${String(nextSeq).padStart(5, '0')}`;
            nextSeq++;
            const serialNo = line.serialNo ? `${line.serialNo}-${i}` : `SN-${Math.floor(Math.random()*900000)+100000}`;

            await tx.asset.create({
              data: {
                assetId,
                assetName: line.description,
                description: line.remarks || line.description,
                category,
                serialNo,
                barcode: line.assetTag || assetId,
                purchaseDate: new Date(),
                capitalizationDate: new Date(),
                purchaseCost: itemPrice,
                incidentalCosts: 0,
                capitalizedCost,
                usefulLife,
                depreciationMethod: 'SLM',
                depreciationRate: depRate,
                monthlyDepreciation: monthlyDep,
                accumulatedDepreciation: 0,
                bookValue: capitalizedCost,
                salvageValue,
                location: data.receivingLocation || data.location || 'HQ Office',
                department: po.costCenter.replace('CC-', '').split('-')[0] || 'IT',
                costCenter: po.costCenter,
                vendorName: po.vendorName,
                vendorCode: po.vendorCode,
                poNo: po.poNo,
                warrantyExpiry: new Date(new Date().setMonth(new Date().getMonth() + 12))
              }
            });
          }
        }
      }

      return grpo;
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    const mappedGrpo = mapGRPOToFrontend({
      ...result,
      items: result.items?.map(item => {
        const poLine = po?.items?.find(pi => pi.lineNo === item.poLineRef || pi.description === item.description);
        return {
          ...item,
          unitPrice: poLine ? Number(poLine.unitPrice) : 0,
          gstRate: poLine ? Number(poLine.gstRate) : 18,
          hsnCode: poLine ? poLine.hsnCode : ''
        };
      })
    });

    triggerAssetGRPOCreated({
      grpoNo: result.grpoNo,
      grpoId: result.id,
      poNo: result.poNo,
      vendorName: result.vendorName,
      receivedBy: result.receivedBy,
      qcStatus: result.qcStatus,
      itemCount: (data.items || []).length,
      actorId: data.receivedById || data.actorId || 'system',
      actorRole: 'MATERIALS_RECEIVER'
    }).catch(err => console.error('Asset GRPO notification failed:', err.message));

    const hasDiscrepancy = result.items?.some(item => 
      item.receivedQty < item.orderedQty || 
      (item.condition && item.condition.toLowerCase() !== 'good')
    );

    if (hasDiscrepancy) {
      prisma.supplier.findFirst({
        where: { name: { equals: result.vendorName, mode: 'insensitive' } }
      }).then(supplier => {
        if (supplier) {
          sendGRPODiscrepancyNotice(result, po, supplier);
        }
      }).catch(err => console.error('Failed to send GRPO discrepancy notice:', err));
    }

    return mappedGrpo;
  }

  // A/P Invoice Services
  async getInvoices() {
    const invoices = await prisma.assetAPInvoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    const suppliers = await prisma.supplier.findMany({
      select: { name: true, signatureImage: true, companySealImage: true }
    });
    return invoices.map(inv => {
      const mapped = mapInvoiceToFrontend(inv);
      if (mapped) {
        const supplier = suppliers.find(s => s.name.toLowerCase() === inv.vendorName.toLowerCase());
        mapped.supplier = supplier || null;
      }
      return mapped;
    });
  }

  async createAPInvoice(data) {
    const isDirect = Boolean(data.isDirect);
    let grpoNo = isDirect ? 'Direct' : data.grpoNo;
    let poNo = isDirect ? 'Direct' : data.poNo;

    let po = null;
    let grpo = null;

    if (!isDirect) {
      if (data.grpoId) {
        const grpoRec = await prisma.assetGRPO.findUnique({
          where: { id: data.grpoId }
        });
        if (grpoRec) {
          grpoNo = grpoRec.grpoNo;
          poNo = grpoRec.poNo;
        }
      }

      if (grpoNo && grpoNo !== 'Direct') {
        const existingInvoice = await prisma.assetAPInvoice.findFirst({
          where: {
            grpoNo,
            status: { not: 'Cancelled' }
          }
        });
        if (existingInvoice) {
          throw new Error(`An AP Invoice (${existingInvoice.invoiceNo}) has already been billed for GRPO ${grpoNo}. Duplicate billing is not allowed.`);
        }
      }

      po = await prisma.assetPO.findUnique({
        where: { poNo },
        include: { items: true }
      });
      if (!po) throw new Error('PO reference not found');

      grpo = await prisma.assetGRPO.findUnique({
        where: { grpoNo },
        include: { items: true }
      });
      if (!grpo) throw new Error('GRPO reference not found');
    }

    const applyGst = data.applyGst !== false;
    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || 'BCLNU556863412';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const vendorGstin = data.vendorGstin || '';
    const vendorStateCode = vendorGstin.trim().substring(0, 2);
    const isInterState = vendorStateCode && companyStateCode ? (vendorStateCode !== companyStateCode) : (data.isInterState === true);

    const invoiceItems = (data.items || []).map((item, idx) => {
      const quantity = parseInt(item.quantity, 10);
      const unitPrice = Number(item.unitPrice);
      const discountPercent = Number(item.discountPercent || 0);
      const taxableValue = Number(item.taxableValue || item.totalBeforeTax || (quantity * unitPrice));
      const gstRate = Number(item.gstRate || 18);
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (applyGst) {
        const gstAmount = taxableValue * (gstRate / 100);
        if (isInterState) {
          igst = gstAmount;
        } else {
          cgst = gstAmount / 2;
          sgst = gstAmount / 2;
        }
      }

      const lineTotal = taxableValue + cgst + sgst + igst;

      return {
        lineNo: item.lineNo || (idx + 1),
        itemCode: item.itemCode || `AST-IT-${String(idx + 1).padStart(3, '0')}`,
        description: item.description || item.itemDescription || '',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        quantity,
        unitPrice,
        discountPercent,
        taxableValue,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal
      };
    });

    // 3-Way Match Check (only if not direct billing)
    if (!isDirect) {
      for (const item of invoiceItems) {
        const poLine = po.items.find(pi => pi.lineNo === item.lineNo || pi.description === item.description);
        const grpoLine = grpo.items.find(gi => gi.poLineRef === item.lineNo || gi.description === item.description);

        if (!poLine) throw new Error(`Line item "${item.description}" not found in reference PO.`);
        if (!grpoLine) throw new Error(`Line item "${item.description}" not found in reference GRPO.`);

        if (item.quantity > poLine.orderedQty) {
          throw new Error(`3-Way Match Exception: Invoiced quantity (${item.quantity}) exceeds PO ordered quantity (${poLine.orderedQty}) on "${item.description}".`);
        }
        if (item.quantity > grpoLine.acceptedQty) {
          throw new Error(`3-Way Match Exception: Invoiced quantity (${item.quantity}) exceeds GRPO accepted quantity (${grpoLine.acceptedQty}) on "${item.description}".`);
        }

        const poPrice = Number(poLine.unitPrice);
        const invPrice = Number(item.unitPrice);
        const priceVariance = Math.abs(poPrice - invPrice) / poPrice;
        if (priceVariance > 0.02) {
          throw new Error(`3-Way Match Exception: Price variance exceeds 2% (PO Price: ₹${poPrice.toLocaleString('en-IN')}, Invoice Price: ₹${invPrice.toLocaleString('en-IN')}) on "${item.description}".`);
        }
      }

      if (po.vendorGstin && data.vendorGstin && po.vendorGstin.trim() !== data.vendorGstin.trim()) {
        throw new Error(`3-Way Match Exception: Vendor GSTIN on invoice (${data.vendorGstin}) does not match purchase order (${po.vendorGstin}).`);
      }
    }

    const taxableAmount = invoiceItems.reduce((s, i) => s + i.taxableValue, 0);
    const totalCgst = invoiceItems.reduce((s, i) => s + i.cgst, 0);
    const totalSgst = invoiceItems.reduce((s, i) => s + i.sgst, 0);
    const totalIgst = invoiceItems.reduce((s, i) => s + i.igst, 0);

    const discount = Number(data.discount || 0);
    const freight = Number(data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(freight, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = totalCgst;
    let finalSgst = totalSgst;
    let finalIgst = totalIgst;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const totalTax = finalCgst + finalSgst + finalIgst;
    const preRoundTotal = taxableAmount + totalTax + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    const amountInWords = numberToWordsIndian(grandTotal);

    // TDS Deduction: 194Q requires 0.1% TDS on goods value exceeding 50 Lakhs
    let tdsAmount = Number(data.tds || 0);
    if (tdsAmount === 0 && grandTotal > 5000000) {
      tdsAmount = (grandTotal - 5000000) * 0.001; 
    }

    const netPayable = grandTotal - tdsAmount;

    const invoiceNo = await this.getNextDocNumber('INV');

    const fallbackGstin = taxSettings?.companyGstin || 'BCLNU556863412';
    const fallbackPan = taxSettings?.companyPan || (fallbackGstin.length >= 12 ? fallbackGstin.substring(2, 12) : 'BCLNU55686');

    const res = await prisma.assetAPInvoice.create({
      data: {
        invoiceNo,
        vendorInvoiceNo: data.vendorInvoiceNo || `VINV-${Math.floor(Math.random()*90000)+10000}`,
        vendorInvoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        postingDate: new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(new Date().setDate(new Date().getDate() + 30)),
        poNo,
        grpoNo,
        supplierQuoteRef: data.supplierQuoteRef || (po ? po.supplierQuoteRef : '') || '',
        vendorCode: data.vendorCode || (po ? po.vendorCode : ('V-' + Math.floor(Math.random()*9000 + 1000))),
        vendorName: data.vendorName || (po ? po.vendorName : ''),
        vendorGstin: data.vendorGstin || (po ? po.vendorGstin : ''),
        vendorPan: data.vendorPan || (po ? po.vendorPan : ''),
        address: data.address || data.vendorAddress || (po ? po.address : ''),
        companyGstin: data.companyGstin || (po ? po.companyGstin : fallbackGstin),
        companyPan: data.companyPan || (po ? po.companyPan : fallbackPan),
        placeOfSupply: data.placeOfSupply || (po ? po.placeOfSupply : '29'),
        irn: data.irn || `IRN-${Math.floor(Math.random()*9000000000)+1000000000}`,
        qrCodeRef: data.qrCodeRef || 'QR-INVOICE-PLACEHOLDER',
        taxableAmount,
        totalCgst: finalCgst,
        totalSgst: finalSgst,
        totalIgst: finalIgst,
        totalTax,
        chargeGstStates,
        freight,
        discount: discount,
        loadingCharges,
        unloadingCharges,
        packingCharges,
        insurance,
        isInterState,
        applyGst,
        otherCharges: otherCharges,
        roundOff: roundOff,
        paymentMode: data.paymentMode || '',
        paymentTerms: data.paymentTerms || '',
        termsBlock: data.termsAndConditions || data.termsBlock || '',
        invoiceTotal: grandTotal,
        amountInWords,
        tdsAmount,
        netPayable,
        bankName: data.bankName || 'HDFC Bank',
        bankAccountHolder: data.bankAccountHolder || (po ? po.vendorName : (data.vendorName || 'Vendor')),
        bankAccountNo: data.bankAccountNo || '50200012345678',
        bankIfsc: data.bankIfsc || 'HDFC0000123',
        bankBranch: data.bankBranch || 'Main Branch, Mumbai',
        bankUpi: data.bankUpi || '',
        paymentInstructions: 'Please quote Invoice No on remittances.',
        lateInterestClause: 'Interest at 18% p.a. charged on overdue amounts.',
        contactQuery: 'accounts@company.com',
        signatoryBlock: 'For Company Authorized Signatory',
        status: 'Posted',
        items: {
          create: invoiceItems
        }
      },
      include: { items: true }
    });

    const supplier = await prisma.supplier.findFirst({
      where: { name: { equals: res.vendorName, mode: 'insensitive' } },
      select: { name: true, signatureImage: true, companySealImage: true }
    });

    const mappedInv = mapInvoiceToFrontend(res);
    if (mappedInv) {
      mappedInv.supplier = supplier || null;
    }

    triggerAssetAPInvoiceCreated({
      invoiceNo: res.invoiceNo,
      invoiceId: res.id,
      poNo: res.poNo,
      grpoNo: res.grpoNo,
      vendorName: res.vendorName,
      vendorGstin: res.vendorGstin,
      grandTotal: res.invoiceTotal,
      netPayable: res.netPayable,
      dueDate: res.dueDate,
      actorId: data.actorId || 'system',
      actorRole: data.actorRole || 'PURCHASE_ACCOUNTANT'
    }).catch(err => console.error('Asset invoice notification failed:', err.message));

    return mappedInv;
  }

  async markInvoicePaid(id, userId = 'system', actorRole = 'PURCHASE_ACCOUNTANT', pdfBase64 = null) {
    const res = await prisma.assetAPInvoice.update({
      where: { id },
      data: { status: 'Paid' },
      include: { items: true }
    });

    const supplier = await prisma.supplier.findFirst({
      where: { name: { equals: res.vendorName, mode: 'insensitive' } },
      select: { name: true, signatureImage: true, companySealImage: true }
    });

    const mapped = mapInvoiceToFrontend(res);
    if (mapped) {
      mapped.supplier = supplier || null;
    }

    triggerAssetInvoicePaid({
      invoiceNo: res.invoiceNo,
      invoiceId: res.id,
      vendorName: res.vendorName,
      netPayable: res.netPayable,
      actorId: userId,
      actorRole: actorRole
    }).catch(err => console.error('Asset invoice paid notification failed:', err.message));

    prisma.supplier.findFirst({
      where: { name: { equals: res.vendorName, mode: 'insensitive' } }
    }).then(supplierData => {
      sendAPInvoiceAutomatedEmail(res, supplierData, pdfBase64);
    }).catch(err => console.error('Failed to send AP Invoice email/whatsapp on mark paid:', err));

    return mapped;
  }

  // Register Services
  async getAssets() {
    const assets = await prisma.asset.findMany({
      orderBy: { assetId: 'asc' }
    });
    return assets.map(mapAssetToFrontend);
  }

  async getAssetById(id) {
    const asset = await prisma.asset.findUnique({
      where: { id }
    });
    return mapAssetToFrontend(asset);
  }

  async decommissionAsset(id, userId = 'system', actorRole = 'MAIN_MASTER') {
    const res = await prisma.asset.update({
      where: { id },
      data: {
        status: 'Disposed',
        disposalDate: new Date(),
        disposalMethod: 'Decommissioned'
      }
    });
    const mapped = mapAssetToFrontend(res);

    triggerAssetDecommissioned({
      assetId: res.assetId,
      assetName: res.assetName,
      category: res.category,
      department: res.department,
      bookValue: res.bookValue,
      actorId: userId,
      actorRole: actorRole
    }).catch(err => console.error('Asset decommission notification failed:', err.message));

    return mapped;
  }

  // GSTIN Live Verification
  async verifyGSTIN(gstin) {
    const cleanGstin = gstin.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(cleanGstin)) {
      throw new Error('Invalid GSTIN format. Must be 15 characters: 2-digit state code + 10-char PAN + entity digit + Z + check digit.');
    }

    const STATE_MAP = {
      '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
      '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
      '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
      '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
      '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
      '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra',
      '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
      '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
      '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
      '36': 'Telangana', '37': 'Andhra Pradesh (New)', '38': 'Ladakh',
      '97': 'Other Territory', '99': 'Centre Jurisdiction'
    };

    const ENTITY_MAP = {
      'C': 'Company (Private/Public)', 'F': 'Firm / LLP',
      'H': 'Hindu Undivided Family', 'A': 'Association of Persons',
      'T': 'Trust or Trustee', 'B': 'Body of Individuals',
      'L': 'Local Authority', 'J': 'Artificial Juridical Person',
      'G': 'Government', 'P': 'Individual / Sole Proprietor'
    };

    const stateCode = cleanGstin.substring(0, 2);
    const pan = cleanGstin.substring(2, 12);
    const entityChar = pan.charAt(3).toUpperCase();
    const stateName = STATE_MAP[stateCode] || 'Unknown State';
    const entityType = ENTITY_MAP[entityChar] || 'Regular';

    // Try calling the free GST portal API
    try {
      const response = await axios.get(
        `https://api.gst.gov.in/commonapi/v1.1/search?action=TP&gstin=${cleanGstin}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'requestid': `ERP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            'og': 'GST',
            'Accept': 'application/json'
          },
          timeout: 7000
        }
      );

      if (response.data && response.data.taxpayerInfo) {
        const info = response.data.taxpayerInfo;
        return {
          success: true,
          source: 'live',
          gstin: cleanGstin,
          legalName: info.lgnm || info.tradeNam || '',
          tradeName: info.tradeNam || info.lgnm || '',
          status: info.sts || 'Active',
          registrationDate: info.rgdt || '',
          lastUpdatedDate: info.lstupdt || '',
          constitutionOfBusiness: info.ctb || entityType,
          taxpayerType: info.dty || 'Regular',
          stateCode,
          state: stateName,
          pan,
          principalAddress: info.pradr ? (
            [info.pradr.adr?.bnm, info.pradr.adr?.st, info.pradr.adr?.loc,
             info.pradr.adr?.dst, info.pradr.adr?.stcd, info.pradr.adr?.pncd]
            .filter(Boolean).join(', ')
          ) : '',
          gstinType: entityChar,
          entityType
        };
      }
    } catch (apiErr) {
      // API not accessible - use intelligent fallback
      console.log('GST API unavailable, using intelligent GSTIN parsing fallback:', apiErr.message);
    }

    // Intelligent fallback: parse what we can from the GSTIN itself
    // This returns structured data from GSTIN format analysis
    const formatted = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '/');

    return {
      success: true,
      source: 'parsed',
      gstin: cleanGstin,
      legalName: '',          // Cannot determine without live API
      tradeName: '',          // Cannot determine without live API
      status: 'Active',       // Assume active if format is valid
      registrationDate: '01/07/2017',
      lastUpdatedDate: formatted,
      constitutionOfBusiness: entityType,
      taxpayerType: 'Regular',
      stateCode,
      state: stateName,
      pan,
      principalAddress: '',   // Cannot determine without live API
      gstinType: entityChar,
      entityType,
      warning: 'Live GST registry could not be reached. Showing parsed data from GSTIN format only. Legal name and address require live verification.'
    };
  }

  async getAssetDepreciation(id, dateStr) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const capDate = new Date(asset.capitalizationDate);

    if (targetDate < capDate) {
      return {
        asset: mapAssetToFrontend(asset),
        accumulatedDepreciation: 0,
        currentBookValue: Number(asset.capitalizedCost),
        depreciationSchedule: []
      };
    }

    const diffMonths = (targetDate.getFullYear() - capDate.getFullYear()) * 12 + (targetDate.getMonth() - capDate.getMonth());
    const monthlyDep = Number(asset.monthlyDepreciation);
    const usefulLifeMonths = Number(asset.usefulLife) * 12;

    const schedule = [];
    let accumulated = 0;
    const capitalizedCost = Number(asset.capitalizedCost);
    const salvage = Number(asset.salvageValue);

    for (let m = 1; m <= Math.min(diffMonths, usefulLifeMonths); m++) {
      accumulated += monthlyDep;
      const bookVal = Math.max(salvage, capitalizedCost - accumulated);
      
      const currentMonth = new Date(capDate);
      currentMonth.setMonth(capDate.getMonth() + m);

      schedule.push({
        month: currentMonth.toLocaleString('default', { month: 'short', year: 'numeric' }),
        depreciation: monthlyDep,
        accumulatedDepreciation: accumulated,
        bookValue: bookVal
      });
    }

    const accumulatedDepreciation = Math.min(accumulated, capitalizedCost - salvage);
    const currentBookValue = Math.max(salvage, capitalizedCost - accumulatedDepreciation);

    return {
      asset: mapAssetToFrontend(asset),
      accumulatedDepreciation,
      currentBookValue,
      depreciationSchedule: schedule
    };
  }

  // Reports
  async getReports(type, dateStr) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();

    // Report 1: Asset Register Report
    if (type === 'register' || type === 'asset-register') {
      const assets = await prisma.asset.findMany();
      return assets.map(mapAssetToFrontend);
    }

    // Report 2: Depreciation Schedule Report
    if (type === 'depreciation') {
      const assets = await prisma.asset.findMany();
      const report = [];
      for (const ast of assets) {
        const depInfo = await this.getAssetDepreciation(ast.id, targetDate);
        report.push({
          assetId: ast.assetId,
          assetName: ast.assetName,
          category: ast.category,
          capitalizedCost: Number(ast.capitalizedCost),
          accumulatedDepreciation: depInfo.accumulatedDepreciation,
          bookValue: depInfo.currentBookValue
        });
      }
      return report;
    }

    // Report 3: PO Status Report
    if (type === 'po-status') {
      const pos = await prisma.assetPO.findMany({
        include: { items: true }
      });
      return pos.map(po => ({
        poNo: po.poNo,
        poDate: po.createdAt,
        vendorName: po.vendorName,
        grandTotal: Number(po.grandTotal),
        status: po.status,
        itemCount: po.items?.length || 0,
        deliveryDate: po.deliveryDate
      }));
    }

    // Report 4: Vendor Performance Report
    if (type === 'vendor-performance') {
      const grpos = await prisma.assetGRPO.findMany({
        include: { items: true }
      });
      const performanceMap = {};
      
      for (const grpo of grpos) {
        const vendor = grpo.vendorName;
        if (!performanceMap[vendor]) {
          performanceMap[vendor] = { name: vendor, receivedCount: 0, acceptedQty: 0, rejectedQty: 0, rating: 5.0 };
        }
        performanceMap[vendor].receivedCount += 1;
        for (const it of grpo.items) {
          performanceMap[vendor].acceptedQty += it.acceptedQty;
          performanceMap[vendor].rejectedQty += it.rejectedQty;
        }
      }

      const report = Object.values(performanceMap).map(p => {
        const total = p.acceptedQty + p.rejectedQty;
        const rejectRatio = total > 0 ? p.rejectedQty / total : 0;
        // Simple rating logic: subtract points for rejects
        p.rating = Math.max(1.0, 5.0 - rejectRatio * 5.0).toFixed(1);
        return p;
      });
      return report;
    }

    // Report 5: Budget vs Actual Report
    if (type === 'budget' || type === 'budget-actual') {
      await this.seedBudgets();
      const budgets = await prisma.departmentBudget.findMany();
      return budgets.map(b => ({
        department: b.department,
        allocated: Number(b.allocated),
        utilized: Number(b.utilized),
        remaining: Number(b.remaining),
        utilizationPercentage: b.allocated > 0 ? ((Number(b.utilized) / Number(b.allocated)) * 100).toFixed(1) : '0.0'
      }));
    }

    // Report 6: Aging Report (A/P)
    if (type === 'ap-aging') {
      const invoices = await prisma.assetAPInvoice.findMany({
        where: { status: { not: 'Paid' } }
      });
      const today = new Date();
      const report = invoices.map(inv => {
        const due = new Date(inv.dueDate);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        let bucket = 'Not Due';
        if (diffDays < 0) {
          const overdue = Math.abs(diffDays);
          if (overdue <= 30) bucket = '1-30 Days Overdue';
          else if (overdue <= 60) bucket = '31-60 Days Overdue';
          else bucket = 'Above 60 Days Overdue';
        }
        return {
          invoiceNo: inv.invoiceNo,
          vendorInvoiceNo: inv.vendorInvoiceNo,
          vendorName: inv.vendorName,
          netPayable: Number(inv.netPayable),
          dueDate: inv.dueDate,
          daysRemaining: diffDays,
          agingBucket: bucket
        };
      });
      return report;
    }

    // Report 7: Asset Movement Report (Current active register distribution)
    if (type === 'movement' || type === 'asset-movement') {
      const assets = await prisma.asset.findMany({
        where: { status: { not: 'Disposed' } }
      });
      return assets.map(ast => ({
        assetId: ast.assetId,
        assetName: ast.assetName,
        category: ast.category,
        department: ast.department,
        location: ast.location,
        assignedTo: ast.assignedTo || 'Unassigned',
        capitalizedCost: Number(ast.capitalizedCost)
      }));
    }

    // Report 8: Asset Disposal Report
    if (type === 'disposal' || type === 'asset-disposal') {
      const assets = await prisma.asset.findMany({
        where: { status: 'Disposed' }
      });
      return assets.map(ast => ({
        assetId: ast.assetId,
        assetName: ast.assetName,
        category: ast.category,
        capitalizedCost: Number(ast.capitalizedCost),
        disposalDate: ast.disposalDate,
        disposalMethod: ast.disposalMethod || 'Decommissioned',
        disposalProceeds: ast.disposalProceeds ? Number(ast.disposalProceeds) : 0,
        gainLoss: ast.disposalGainLoss ? Number(ast.disposalGainLoss) : -Number(ast.bookValue) // default loss is full book value
      }));
    }

    // Report 9: Warranty Expiry Report
    if (type === 'warranty' || type === 'warranty-expiry') {
      const assets = await prisma.asset.findMany({
        where: {
          warrantyExpiry: { not: null },
          status: { not: 'Disposed' }
        }
      });
      const today = new Date();
      return assets.map(ast => {
        const exp = new Date(ast.warrantyExpiry);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return {
          assetId: ast.assetId,
          assetName: ast.assetName,
          category: ast.category,
          vendorName: ast.vendorName || 'N/A',
          warrantyExpiry: ast.warrantyExpiry,
          daysToExpiry: diffDays
        };
      }).filter(ast => ast.daysToExpiry <= 90); // Next 90 days expiry
    }

    // Report 10: Maintenance Due Report
    if (type === 'maintenance' || type === 'maintenance-due') {
      const assets = await prisma.asset.findMany({
        where: {
          nextMaintenance: { not: null },
          status: 'Active'
        }
      });
      return assets.map(ast => ({
        assetId: ast.assetId,
        assetName: ast.assetName,
        category: ast.category,
        location: ast.location,
        nextMaintenance: ast.nextMaintenance
      }));
    }

    // Report 11: GST Input Credit Summary
    if (type === 'gst-itc') {
      const invoices = await prisma.assetAPInvoice.findMany({
        include: { items: true }
      });

      let eligible = 0;
      let blocked = 0;

      const report = invoices.flatMap(inv => {
        return inv.items.map(item => {
          const isBlocked = ['Vehicles', 'Infrastructure'].includes(item.category) || item.description.toLowerCase().includes('car');
          const tax = Number(item.cgst) + Number(item.sgst) + Number(item.igst);

          if (isBlocked) blocked += tax;
          else eligible += tax;

          return {
            invoiceNo: inv.invoiceNo,
            vendorName: inv.vendorName,
            description: item.description,
            category: item.category,
            taxValue: Number(item.taxableValue),
            taxAmount: tax,
            itcEligibility: isBlocked ? 'Blocked' : 'Eligible',
            legalRef: isBlocked ? 'Section 17(5) Blocked' : 'Eligible Input Credit'
          };
        });
      });

      return {
        summary: { eligible, blocked, total: eligible + blocked },
        details: report
      };
    }

    // Report 12: Asset Category Summary
    if (type === 'category-summary') {
      const assets = await prisma.asset.findMany();
      const categories = {};
      for (const ast of assets) {
        const cat = ast.category;
        if (!categories[cat]) {
          categories[cat] = { category: cat, count: 0, totalCost: 0, bookValue: 0 };
        }
        categories[cat].count += 1;
        categories[cat].totalCost += Number(ast.capitalizedCost);
        categories[cat].bookValue += Number(ast.bookValue);
      }
      return Object.values(categories);
    }

    // Report 13: Three-Way Match Exception Report
    if (type === 'threeway-exceptions') {
      const invoices = await prisma.assetAPInvoice.findMany();
      return invoices.filter(inv => inv.status === 'Exception').map(inv => ({
        invoiceNo: inv.invoiceNo,
        vendorInvoiceNo: inv.vendorInvoiceNo,
        vendorName: inv.vendorName,
        poNo: inv.poNo,
        grpoNo: inv.grpoNo,
        postingDate: inv.postingDate,
        amount: Number(inv.invoiceTotal),
        remarks: 'Three-Way Match price/quantity variance detected.'
      }));
    }

    // Default: Return all assets
    const assets = await prisma.asset.findMany();
    return assets.map(mapAssetToFrontend);
  }

  async updatePR(id, data) {
    const existing = await prisma.assetRequest.findUnique({ where: { id } });
    if (!existing) throw new Error('Purchase Request not found');

    const nextPQ = await prisma.assetPQ.findFirst({
      where: { prNo: existing.prNo }
    });
    if (nextPQ) {
      throw new Error('Cannot edit this Purchase Request because a Purchase Quotation has already been created for it.');
    }

    let items = data.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      items = [{
        assetName: data.assetName,
        category: data.category,
        hsnCode: data.hsnCode || '84713010',
        hsnDescription: data.hsnDescription || '',
        specifications: data.specifications || '',
        quantity: parseInt(data.quantity, 10) || 1,
        estimatedUnitCost: Number(data.estimatedUnitCost) || 0
      }];
    }

    let estimatedTotalCost = 0;
    items.forEach(item => {
      estimatedTotalCost += (parseInt(item.quantity, 10) || 0) * (Number(item.estimatedUnitCost) || 0);
    });

    const primaryItem = items[0];

    const result = await prisma.assetRequest.update({
      where: { id },
      data: {
        requesterName: data.requesterName,
        requesterEmpId: data.requesterEmpId,
        department: data.department,
        costCenter: data.costCenter || `CC-${data.department}-001`,
        category: primaryItem.category,
        assetName: primaryItem.assetName,
        hsnCode: primaryItem.hsnCode || '84713010',
        hsnDescription: primaryItem.hsnDescription || '',
        specifications: primaryItem.specifications || '',
        quantity: parseInt(primaryItem.quantity, 10) || 1,
        estimatedUnitCost: Number(primaryItem.estimatedUnitCost) || 0,
        estimatedTotalCost,
        requiredByDate: new Date(data.requiredByDate),
        priority: data.priority,
        justification: data.justification,
        preferredVendor: data.preferredVendor,
        attachments: data.attachments,
        items: items
      }
    });
    return result;
  }

  async deletePR(id) {
    const existing = await prisma.assetRequest.findUnique({ where: { id } });
    if (!existing) throw new Error('Purchase Request not found');

    const nextPQ = await prisma.assetPQ.findFirst({
      where: { prNo: existing.prNo }
    });
    if (nextPQ) {
      throw new Error('Cannot delete this Purchase Request because a Purchase Quotation has already been created for it.');
    }

    await prisma.assetRequest.delete({ where: { id } });
    return { success: true };
  }

  async deletePQ(id) {
    const existing = await prisma.assetPQ.findUnique({
      where: { id }
    });
    if (!existing) throw new Error('Quotation not found');

    const po = await prisma.assetPO.findFirst({
      where: { prNo: existing.prNo, status: { not: 'Cancelled' } }
    });
    if (po) {
      throw new Error('Cannot delete this Purchase Quotation because a Purchase Order has already been issued for this request.');
    }

    await prisma.assetPQ.delete({ where: { id } });
    return { success: true };
  }

  async updatePO(id, data) {
    const existing = await prisma.assetPO.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('Purchase Order not found');

    const grpo = await prisma.assetGRPO.findFirst({
      where: { poNo: existing.poNo }
    });
    if (grpo) {
      throw new Error('Cannot edit this Purchase Order because a Goods Receipt PO has already been created for it.');
    }

    const applyGst = data.applyGst !== false;
    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || '33AABCL0702C1ZG';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const vendorGstin = data.vendorGstin || existing.vendorGstin || '';
    const vendorStateCode = vendorGstin.trim().substring(0, 2);
    const isInterState = vendorStateCode && companyStateCode ? (vendorStateCode !== companyStateCode) : (data.isInterState === true);
    const deptCode = existing.costCenter.replace('CC-', '').split('-')[0] || 'IT';

    const poItems = (data.items || []).map((item, idx) => {
      const orderedQty = parseInt(item.quantity || item.orderedQty || 1, 10);
      const unitPrice = Number(item.unitPrice || 0);
      const discountPercent = Number(item.discountPercent || 0);
      const baseAmount = orderedQty * unitPrice * (1 - discountPercent/100);
      const gstRate = Number(item.gstRate || 18);
      const gstAmount = applyGst ? (baseAmount * gstRate / 100) : 0;
      const lineTotal = baseAmount + gstAmount;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (applyGst) {
        if (isInterState) {
          igst = gstAmount;
        } else {
          cgst = gstAmount / 2;
          sgst = gstAmount / 2;
        }
      }

      return {
        lineNo: item.lineNo || (idx + 1),
        itemCode: item.itemCode || `AST-${deptCode}-${idx + 1}`,
        description: item.itemDescription || item.description || '',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        orderedQty,
        receivedQty: 0,
        pendingQty: orderedQty,
        unitPrice,
        discountPercent,
        baseAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        targetDeliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        remarks: item.remarks || ''
      };
    });

    const existingItems = existing.items || [];
    const newItems = poItems || [];

    const existingMap = new Map(existingItems.map(item => [item.itemCode, item]));
    const newMap = new Map(newItems.map(item => [item.itemCode, item]));

    const deletedItems = [];
    const addedItems = [];
    const updatedItems = [];

    for (const extItem of existingItems) {
      if (!newMap.has(extItem.itemCode)) {
        deletedItems.push(extItem);
      } else {
        const newItem = newMap.get(extItem.itemCode);
        const qtyChanged = extItem.orderedQty !== newItem.orderedQty;
        const priceChanged = Number(extItem.unitPrice) !== Number(newItem.unitPrice);
        if (qtyChanged || priceChanged) {
          updatedItems.push(newItem);
        }
      }
    }

    for (const newItem of newItems) {
      if (!existingMap.has(newItem.itemCode)) {
        addedItems.push(newItem);
      }
    }

    const subtotal = poItems.reduce((s, i) => s + i.baseAmount, 0);
    const cgstTotal = poItems.reduce((s, i) => s + i.cgst, 0);
    const sgstTotal = poItems.reduce((s, i) => s + i.sgst, 0);
    const igstTotal = poItems.reduce((s, i) => s + i.igst, 0);

    const freight = Number(data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);
    const discountTotal = Number(data.discount || 0);

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      if (isInterState) {
        return Number(val) * 0.18; // Force 18% for IGST
      }
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(freight, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = cgstTotal;
    let finalSgst = sgstTotal;
    let finalIgst = igstTotal;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const taxAmount = finalCgst + finalSgst + finalIgst;
    const tds = Number(data.tds || 0);
    const supplierQuoteRef = data.supplierQuoteRef || data.supplierQuotationRef || '';
    const preRoundTotal = subtotal + taxAmount + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discountTotal - tds;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    const result = await prisma.$transaction(async (tx) => {
      // Revert old budget
      const budget = await tx.departmentBudget.findUnique({
        where: { department: deptCode }
      });
      if (budget) {
        const revertedRemaining = Number(budget.remaining) + Number(existing.grandTotal);
        const revertedUtilized = Number(budget.utilized) - Number(existing.grandTotal);
        
        if (revertedRemaining < grandTotal) {
          throw new Error(`PO update blocked. Remaining budget (₹${revertedRemaining.toLocaleString('en-IN')}) is insufficient for ₹${grandTotal.toLocaleString('en-IN')}.`);
        }

        await tx.departmentBudget.update({
          where: { id: budget.id },
          data: {
            utilized: revertedUtilized + grandTotal,
            remaining: revertedRemaining - grandTotal
          }
        });
      }

      await tx.assetPOItem.deleteMany({
        where: { poId: id }
      });

      const po = await tx.assetPO.update({
        where: { id },
        data: {
          poType: data.poType || existing.poType,
          vendorName: data.vendorName || existing.vendorName,
          vendorGstin: data.vendorGstin || existing.vendorGstin,
          vendorPan: data.vendorPan || existing.vendorPan,
          address: data.vendorAddress || data.address || existing.address,
          shipTo: data.deliveryAddress || data.shipTo || existing.shipTo,
          billTo: data.billTo || existing.billTo,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : existing.deliveryDate,
          paymentTerms: data.paymentTerms || existing.paymentTerms,
          paymentMode: data.paymentMode || existing.paymentMode,
          paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate) : existing.paymentDueDate,
          incoterms: data.incoterms || existing.incoterms,
          placeOfSupply: data.placeOfSupply || existing.placeOfSupply,
          subtotal,
          discount: discountTotal,
          freight,
          loadingCharges,
          unloadingCharges,
          packingCharges,
          insurance,
          isInterState,
          applyGst,
          chargeGstStates: chargeGstStates,
          cgst: finalCgst,
          sgst: finalSgst,
          igst: finalIgst,
          taxAmount,
          shippingCharges: freight,
          otherCharges,
          roundOff,
          grandTotal,
          tds,
          supplierQuoteRef,
          termsBlock: data.termsAndConditions || data.termsBlock || existing.termsBlock,
          items: {
            create: poItems
          }
        },
        include: { items: true }
      });

      return po;
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    // Fetch supplier and send PO item changes notice
    prisma.supplier.findFirst({
      where: { name: { equals: result.vendorName, mode: 'insensitive' } }
    }).then(async (supplier) => {
      if (deletedItems.length > 0) {
        await sendPOUpdateDeleteNotice(result, 'DELETE', deletedItems, supplier);
      }
      if (updatedItems.length > 0) {
        await sendPOUpdateDeleteNotice(result, 'UPDATE', updatedItems, supplier);
      }
      if (addedItems.length > 0) {
        await sendPOUpdateDeleteNotice(result, 'ADD', addedItems, supplier);
      }
    }).catch(err => console.error('Failed to send PO update/delete notices:', err));

    return mapPOToFrontend(result);
  }

  async deletePO(id) {
    const existing = await prisma.assetPO.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('Purchase Order not found');

    const grpo = await prisma.assetGRPO.findFirst({
      where: { poNo: existing.poNo }
    });
    if (grpo) {
      throw new Error('Cannot delete this Purchase Order because a Goods Receipt PO has already been created for it.');
    }

    const deptCode = existing.costCenter.replace('CC-', '').split('-')[0] || 'IT';

    await prisma.$transaction(async (tx) => {
      const budget = await tx.departmentBudget.findUnique({
        where: { department: deptCode }
      });
      if (budget) {
        await tx.departmentBudget.update({
          where: { id: budget.id },
          data: {
            utilized: { decrement: Number(existing.grandTotal) },
            remaining: { increment: Number(existing.grandTotal) }
          }
        });
      }

      if (existing.pqNo) {
        await tx.assetPQ.updateMany({
          where: { pqNo: existing.pqNo },
          data: { status: 'Received' }
        });
      }

      if (existing.prNo) {
        await tx.assetRequest.updateMany({
          where: { prNo: existing.prNo },
          data: { status: 'Approved' }
        });
      }

      await tx.assetPO.delete({
        where: { id }
      });
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    prisma.supplier.findFirst({
      where: { name: { equals: existing.vendorName, mode: 'insensitive' } }
    }).then(supplier => {
      sendPOUpdateDeleteNotice(existing, 'DELETE', existing.items, supplier);
    }).catch(err => console.error('Failed to send PO deletion notice:', err));

    return { success: true };
  }

  async updateGRPO(id, data) {
    const existing = await prisma.assetGRPO.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('GRPO not found');

    const invoice = await prisma.assetAPInvoice.findFirst({
      where: { grpoNo: existing.grpoNo }
    });
    if (invoice) {
      throw new Error('Cannot edit this Goods Receipt PO because an A/P Invoice has already been created for it.');
    }

    const po = await prisma.assetPO.findFirst({
      where: { poNo: existing.poNo },
      include: { items: true }
    });
    if (!po) throw new Error('Linked Purchase Order not found');

    const itemsToCreate = (data.items || []).map((item, idx) => ({
      poLineRef: item.poLineRef || (idx + 1),
      description: item.itemDescription || item.description || '',
      orderedQty: Number(item.poQuantity || item.orderedQty || 0),
      receivedQty: Number(item.receivedQuantity || item.receivedQty || 0),
      acceptedQty: Number(item.acceptedQuantity || item.acceptedQty || 0),
      rejectedQty: Number(item.rejectedQuantity || item.rejectedQty || 0),
      rejectionReason: item.rejectionReason || item.remarks || '',
      condition: item.condition || 'Good',
      serialNo: item.serialNo || '',
      assetTag: item.assetTag || item.assetTagNo || '',
      remarks: item.remarks || ''
    }));

    const result = await prisma.$transaction(async (tx) => {
      for (const oldItem of existing.items) {
        const accepted = Number(oldItem.acceptedQty || 0);
        if (accepted > 0) {
          const assetsToDelete = await tx.asset.findMany({
            where: {
              poNo: existing.poNo,
              assetName: oldItem.description
            },
            orderBy: { createdAt: 'desc' },
            take: accepted
          });
          for (const asset of assetsToDelete) {
            await tx.asset.delete({ where: { id: asset.id } });
          }
        }
      }

      for (const oldItem of existing.items) {
        const poLine = po.items.find(pi => pi.lineNo === oldItem.poLineRef);
        if (poLine) {
          await tx.assetPOItem.update({
            where: { id: poLine.id },
            data: {
              receivedQty: { decrement: Number(oldItem.receivedQty) },
              pendingQty: { increment: Number(oldItem.receivedQty) }
            }
          });
        }
      }

      await tx.assetGRPOItem.deleteMany({
        where: { grpoId: id }
      });

      const grpo = await tx.assetGRPO.update({
        where: { id },
        data: {
          challanNo: data.challanNo || data.deliveryNoteNo || existing.challanNo,
          transporter: data.transporter || existing.transporter,
          vehicleNo: data.vehicleNo || existing.vehicleNo,
          receivedBy: data.receivedBy || existing.receivedBy,
          location: data.receivingLocation || data.location || existing.location,
          qcStatus: data.qcStatus || existing.qcStatus,
          qcInspector: data.qcInspector || data.receivedBy || existing.qcInspector,
          items: {
            create: itemsToCreate
          }
        },
        include: { items: true }
      });

      const freshPOLines = await tx.assetPOItem.findMany({
        where: { poId: po.id }
      });

      let allFullyReceived = true;
      for (const line of itemsToCreate) {
        const poLine = freshPOLines.find(pi => pi.lineNo === line.poLineRef);
        if (poLine) {
          const updatedReceived = Number(poLine.receivedQty) + Number(line.receivedQty);
          const updatedPending = Math.max(0, Number(poLine.orderedQty) - updatedReceived);
          
          if (updatedPending > 0) {
            allFullyReceived = false;
          }

          await tx.assetPOItem.update({
            where: { id: poLine.id },
            data: {
              receivedQty: updatedReceived,
              pendingQty: updatedPending
            }
          });
        }
      }

      await tx.assetPO.update({
        where: { id: po.id },
        data: {
          status: allFullyReceived ? 'Closed' : 'Partially Received'
        }
      });

      const lastDoc = await tx.asset.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      let nextSeq = 1;
      if (lastDoc?.assetId) {
        const parts = lastDoc.assetId.split('-');
        const lastSeqStr = parts[parts.length - 1];
        const parsed = parseInt(lastSeqStr, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }

      for (const line of itemsToCreate) {
        const accepted = parseInt(line.acceptedQty, 10);
        if (accepted > 0) {
          const poLine = freshPOLines.find(pi => pi.lineNo === line.poLineRef);
          const itemPrice = poLine ? Number(poLine.unitPrice) : 50000;
          
          let category = 'IT Equipment';
          if (poLine?.description?.toLowerCase().includes('chair') || poLine?.description?.toLowerCase().includes('desk') || poLine?.description?.toLowerCase().includes('furniture')) {
            category = 'Furniture & Fixtures';
          } else if (poLine?.description?.toLowerCase().includes('machine') || poLine?.description?.toLowerCase().includes('cnc') || poLine?.description?.toLowerCase().includes('drill')) {
            category = 'Machinery & Plant';
          } else if (poLine?.description?.toLowerCase().includes('car') || poLine?.description?.toLowerCase().includes('truck') || poLine?.description?.toLowerCase().includes('forklift')) {
            category = 'Vehicles';
          } else if (poLine?.description?.toLowerCase().includes('ac') || poLine?.description?.toLowerCase().includes('air conditioner') || poLine?.description?.toLowerCase().includes('ups') || poLine?.description?.toLowerCase().includes('generator')) {
            category = 'Office Equipment';
          } else if (poLine?.description?.toLowerCase().includes('structure') || poLine?.description?.toLowerCase().includes('electrical')) {
            category = 'Infrastructure';
          } else if (poLine?.description?.toLowerCase().includes('software') || poLine?.description?.toLowerCase().includes('license')) {
            category = 'Intangible Assets';
          }

          const mapDetails = CATEGORY_MAP[category] || { life: 5, rate: 20.00 };
          const usefulLife = mapDetails.life;
          const depRate = mapDetails.rate;

          const capitalizedCost = itemPrice; 
          const salvageValue = capitalizedCost * 0.05;
          const annualDep = (capitalizedCost - salvageValue) * (depRate / 100);
          const monthlyDep = annualDep / 12;

          for (let i = 0; i < accepted; i++) {
            const assetId = `AST-${String(nextSeq).padStart(5, '0')}`;
            nextSeq++;
            const serialNo = line.serialNo ? `${line.serialNo}-${i}` : `SN-${Math.floor(Math.random()*900000)+100000}`;

            await tx.asset.create({
              data: {
                assetId,
                assetName: line.description,
                description: line.remarks || line.description,
                category,
                serialNo,
                barcode: line.assetTag || assetId,
                purchaseDate: new Date(),
                capitalizationDate: new Date(),
                purchaseCost: itemPrice,
                incidentalCosts: 0,
                capitalizedCost,
                usefulLife,
                depreciationMethod: 'SLM',
                depreciationRate: depRate,
                monthlyDepreciation: monthlyDep,
                accumulatedDepreciation: 0,
                bookValue: capitalizedCost,
                salvageValue,
                location: data.receivingLocation || data.location || 'HQ Office',
                department: po.costCenter.replace('CC-', '').split('-')[0] || 'IT',
                costCenter: po.costCenter,
                vendorName: po.vendorName,
                vendorCode: po.vendorCode,
                poNo: po.poNo,
                warrantyExpiry: new Date(new Date().setMonth(new Date().getMonth() + 12))
              }
            });
          }
        }
      }

      return grpo;
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    return mapGRPOToFrontend({
      ...result,
      items: result.items?.map(item => {
        const poLine = po?.items?.find(pi => pi.lineNo === item.poLineRef || pi.description === item.description);
        return {
          ...item,
          unitPrice: poLine ? Number(poLine.unitPrice) : 0,
          gstRate: poLine ? Number(poLine.gstRate) : 18,
          hsnCode: poLine ? poLine.hsnCode : ''
        };
      })
    });
  }

  async deleteGRPO(id) {
    const existing = await prisma.assetGRPO.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('GRPO not found');

    const invoice = await prisma.assetAPInvoice.findFirst({
      where: { grpoNo: existing.grpoNo }
    });
    if (invoice) {
      throw new Error('Cannot delete this Goods Receipt PO because an A/P Invoice has already been created for it.');
    }

    const po = await prisma.assetPO.findFirst({
      where: { poNo: existing.poNo },
      include: { items: true }
    });

    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const accepted = Number(item.acceptedQty || 0);
        if (accepted > 0) {
          const assetsToDelete = await tx.asset.findMany({
            where: {
              poNo: existing.poNo,
              assetName: item.description
            },
            orderBy: { createdAt: 'desc' },
            take: accepted
          });
          for (const asset of assetsToDelete) {
            await tx.asset.delete({ where: { id: asset.id } });
          }
        }
      }

      if (po) {
        for (const item of existing.items) {
          const poLine = po.items.find(pi => pi.lineNo === item.poLineRef);
          if (poLine) {
            const updatedReceived = Math.max(0, Number(poLine.receivedQty) - Number(item.receivedQty));
            const updatedPending = Number(poLine.orderedQty) - updatedReceived;

            await tx.assetPOItem.update({
              where: { id: poLine.id },
              data: {
                receivedQty: updatedReceived,
                pendingQty: updatedPending
              }
            });
          }
        }

        const freshLines = await tx.assetPOItem.findMany({
          where: { poId: po.id }
        });
        const anyReceived = freshLines.some(l => Number(l.receivedQty) > 0);
        const allReceived = freshLines.every(l => Number(l.pendingQty) === 0);
        
        let newStatus = 'Approved';
        if (allReceived) newStatus = 'Closed';
        else if (anyReceived) newStatus = 'Partially Received';

        await tx.assetPO.update({
          where: { id: po.id },
          data: { status: newStatus }
        });
      }

      await tx.assetGRPO.delete({
        where: { id }
      });
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    return { success: true };
  }

  async updateInvoice(id, data) {
    const existing = await prisma.assetAPInvoice.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) throw new Error('AP Invoice not found');

    if (existing.status === 'Paid') {
      throw new Error('Cannot edit this AP Invoice because it has already been paid.');
    }

    const applyGst = data.applyGst !== false;
    const taxSettings = await getTaxSettingsData();
    const companyGstin = taxSettings?.companyGstin || '33AABCL0702C1ZG';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const vendorGstin = data.vendorGstin || existing.vendorGstin || '';
    const vendorStateCode = vendorGstin.trim().substring(0, 2);
    const isInterState = vendorStateCode && companyStateCode ? (vendorStateCode !== companyStateCode) : (data.isInterState === true);

    const invoiceItems = (data.items || []).map((item, idx) => {
      const quantity = parseInt(item.quantity, 10);
      const unitPrice = Number(item.unitPrice);
      const discountPercent = Number(item.discountPercent || 0);
      const taxableValue = quantity * unitPrice * (1 - discountPercent / 100);
      const gstRate = Number(item.gstRate || 18);
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (applyGst) {
        const gstAmount = taxableValue * (gstRate / 100);
        if (isInterState) {
          igst = gstAmount;
        } else {
          cgst = gstAmount / 2;
          sgst = gstAmount / 2;
        }
      }

      return {
        lineNo: item.lineNo || (idx + 1),
        itemCode: item.itemCode || `AST-IT-${String(idx + 1).padStart(3, '0')}`,
        description: item.description || item.itemDescription || '',
        hsnCode: item.hsnCode || item.hsnSac || '84713010',
        uom: item.uom || item.unit || 'Nos',
        quantity,
        unitPrice,
        discountPercent,
        taxableValue,
        gstRate,
        cgst,
        sgst,
        igst,
        lineTotal: taxableValue + cgst + sgst + igst
      };
    });

    const taxableAmount = invoiceItems.reduce((s, i) => s + i.taxableValue, 0);
    const totalCgst = invoiceItems.reduce((s, i) => s + i.cgst, 0);
    const totalSgst = invoiceItems.reduce((s, i) => s + i.sgst, 0);
    const totalIgst = invoiceItems.reduce((s, i) => s + i.igst, 0);

    const discount = Number(data.discount || 0);
    const freight = Number(data.freight || 0);
    const loadingCharges = Number(data.loadingCharges || 0);
    const unloadingCharges = Number(data.unloadingCharges || 0);
    const packingCharges = Number(data.packingCharges || 0);
    const insurance = Number(data.insurance || 0);
    const otherCharges = Number(data.otherCharges || 0);

    const chargeGstStates = data.chargeGstStates || {};
    const calculateChargeGst = (val, key) => {
      const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : (key === 'shippingCharges' ? chargeGstStates['freight'] : null));
      if (!state) return 0;
      const isApplied = (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
      if (!isApplied) return 0;
      const customRate = state && state.rate !== undefined ? Number(state.rate) : 18;
      return Number(val) * (customRate / 100);
    };

    const freightGst = calculateChargeGst(freight, 'freight');
    const loadingGst = calculateChargeGst(loadingCharges, 'loadingCharges');
    const unloadingGst = calculateChargeGst(unloadingCharges, 'unloadingCharges');
    const packingGst = calculateChargeGst(packingCharges, 'packingCharges');
    const insuranceGst = calculateChargeGst(insurance, 'insurance');
    const otherGst = calculateChargeGst(otherCharges, 'otherCharges');

    const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

    let finalCgst = totalCgst;
    let finalSgst = totalSgst;
    let finalIgst = totalIgst;

    if (applyGst) {
      if (isInterState) {
        finalIgst += totalChargesGst;
      } else {
        finalCgst += totalChargesGst / 2;
        finalSgst += totalChargesGst / 2;
      }
    }

    const totalTax = finalCgst + finalSgst + finalIgst;
    const preRoundTotal = taxableAmount + totalTax + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    const amountInWords = numberToWordsIndian(grandTotal);

    let tdsAmount = Number(data.tds || 0);
    if (tdsAmount === 0 && grandTotal > 5000000) {
      tdsAmount = (grandTotal - 5000000) * 0.001; 
    }
    const netPayable = grandTotal - tdsAmount;

    await prisma.assetAPInvoiceItem.deleteMany({
      where: { invoiceId: id }
    });

    const res = await prisma.assetAPInvoice.update({
      where: { id },
      data: {
        vendorInvoiceNo: data.vendorInvoiceNo || existing.vendorInvoiceNo,
        vendorInvoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : existing.vendorInvoiceDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        supplierQuoteRef: data.supplierQuoteRef !== undefined ? data.supplierQuoteRef : existing.supplierQuoteRef,
        vendorName: data.vendorName || existing.vendorName,
        vendorGstin: data.vendorGstin || existing.vendorGstin,
        vendorPan: data.vendorPan || existing.vendorPan,
        address: data.address || data.vendorAddress || existing.address,
        taxableAmount,
        totalCgst: finalCgst,
        totalSgst: finalSgst,
        totalIgst: finalIgst,
        totalTax,
        freight,
        discount: discount,
        loadingCharges,
        unloadingCharges,
        packingCharges,
        insurance,
        isInterState,
        applyGst,
        chargeGstStates,
        otherCharges: otherCharges,
        roundOff: roundOff,
        paymentMode: data.paymentMode || existing.paymentMode,
        paymentTerms: data.paymentTerms || existing.paymentTerms,
        termsBlock: data.termsAndConditions || data.termsBlock || existing.termsBlock,
        invoiceTotal: grandTotal,
        amountInWords,
        tdsAmount,
        netPayable,
        bankName: data.bankName || existing.bankName,
        bankAccountHolder: data.bankAccountHolder || existing.bankAccountHolder,
        bankAccountNo: data.bankAccountNo || existing.bankAccountNo,
        bankIfsc: data.bankIfsc || existing.bankIfsc,
        bankBranch: data.bankBranch || existing.bankBranch,
        bankUpi: data.bankUpi !== undefined ? data.bankUpi : existing.bankUpi,
        narration: data.narration || existing.narration,
        items: {
          create: invoiceItems
        }
      },
      include: { items: true }
    });

    return mapInvoiceToFrontend(res);
  }

  async deleteInvoice(id) {
    const existing = await prisma.assetAPInvoice.findUnique({
      where: { id }
    });
    if (!existing) throw new Error('AP Invoice not found');

    if (existing.status === 'Paid') {
      throw new Error('Cannot delete this AP Invoice because it has already been paid.');
    }

    await prisma.assetAPInvoice.delete({
      where: { id }
    });
    return { success: true };
  }
}

// Mappers
function mapPOToFrontend(po) {
  if (!po) return null;
  return {
    ...po,
    poDate: po.poDate || po.createdAt,
    deliveryAddress: po.shipTo,
    freight: Number(po.freight || 0),
    freightCharges: Number(po.freight || po.shippingCharges || 0),
    loadingCharges: Number(po.loadingCharges || 0),
    unloadingCharges: Number(po.unloadingCharges || 0),
    packingCharges: Number(po.packingCharges || 0),
    insurance: Number(po.insurance || 0),
    isInterState: Boolean(po.isInterState),
    applyGst: po.applyGst !== undefined ? Boolean(po.applyGst) : true,
    cgst: Number(po.cgst || 0),
    sgst: Number(po.sgst || 0),
    igst: Number(po.igst || 0),
    discount: Number(po.discount || 0),
    otherCharges: Number(po.otherCharges || 0),
    roundOff: Number(po.roundOff || 0),
    grandTotal: Number(po.grandTotal || 0),
    tds: Number(po.tds || 0),
    supplierQuoteRef: po.supplierQuoteRef || '',
    paymentMode: po.paymentMode || '',
    paymentTerms: po.paymentTerms || '',
    termsAndConditions: po.termsBlock,
    items: po.items?.map(item => ({
      ...item,
      itemDescription: item.description,
      hsnSac: item.hsnCode,
      unit: item.uom,
      quantity: Number(item.orderedQty),
      unitPrice: Number(item.unitPrice),
      gstRate: Number(item.gstRate || 18),        // explicit number — avoids Prisma Decimal serialization issues
      totalBeforeTax: Number(item.baseAmount),
      gstAmount: Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0),
      totalWithGst: Number(item.lineTotal),
      // individual tax components for per-rate breakdown
      cgst: Number(item.cgst || 0),
      sgst: Number(item.sgst || 0),
      igst: Number(item.igst || 0),
    }))
  };
}


function mapPQToFrontend(pq) {
  if (!pq) return null;
  return {
    ...pq,
    validityDate: pq.validUntil,
    expectedDelivery: new Date(new Date(pq.createdAt).setDate(new Date(pq.createdAt).getDate() + (pq.leadTime || 7))),
    subtotal: Number(pq.subtotal || 0),
    discount: Number(pq.discount || 0),
    cgst: Number(pq.cgst || 0),
    sgst: Number(pq.sgst || 0),
    igst: Number(pq.igst || 0),
    taxAmount: Number(pq.taxAmount || 0),
    shippingCharges: Number(pq.shippingCharges || 0),
    otherCharges: Number(pq.otherCharges || 0),
    roundOff: Number(pq.roundOff || 0),
    grandTotal: Number(pq.grandTotal || 0),
    tds: Number(pq.tds || 0),
    supplierQuoteRef: pq.supplierQuoteRef || '',
    paymentMode: pq.paymentMode || '',
    paymentTerms: pq.paymentTerms || '',
    termsAndConditions: pq.termsBlock || '',
    items: pq.items?.map(item => ({
      ...item,
      itemDescription: item.description,
      hsnSac: item.hsnCode,
      unit: item.uom,
      totalBeforeTax: Number(item.baseAmount),
      gstAmount: Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0),
      totalWithGst: Number(item.lineTotal)
    }))
  };
}

function mapGRPOToFrontend(grpo) {
  if (!grpo) return null;
  return {
    ...grpo,
    receivingLocation: grpo.location,
    status: grpo.qcStatus === 'Passed' ? 'Accepted' : grpo.qcStatus,
    receivedDate: grpo.grpoDate,
    deliveryNoteNo: grpo.challanNo,
    items: grpo.items?.map(item => ({
      ...item,
      itemDescription: item.description,
      hsnSac: item.hsnCode || '',
      poQuantity: Number(item.orderedQty),
      receivedQuantity: Number(item.receivedQty),
      acceptedQuantity: Number(item.acceptedQty),
      rejectedQuantity: Number(item.rejectedQty),
      inspectionRemarks: item.remarks,
      unitPrice: Number(item.unitPrice || 0),
      gstRate: Number(item.gstRate || 0)
    }))
  };
}

function mapInvoiceToFrontend(inv) {
  if (!inv) return null;
  return {
    ...inv,
    apInvoiceNo: inv.invoiceNo,
    supplierQuoteRef: inv.supplierQuoteRef || '',
    invoiceDate: inv.vendorInvoiceDate,
    totalGst: Number(inv.totalTax),
    grandTotal: Number(inv.invoiceTotal),
    freight: Number(inv.freight || 0),
    freightGst: Number(inv.freight || 0),
    loadingCharges: Number(inv.loadingCharges || 0),
    unloadingCharges: Number(inv.unloadingCharges || 0),
    packingCharges: Number(inv.packingCharges || 0),
    insurance: Number(inv.insurance || 0),
    isInterState: Boolean(inv.isInterState),
    applyGst: inv.applyGst !== undefined ? Boolean(inv.applyGst) : true,
    discount: Number(inv.discount || 0),
    otherCharges: Number(inv.otherCharges || 0),
    roundOff: Number(inv.roundOff || 0),
    paymentMode: inv.paymentMode || '',
    paymentTerms: inv.paymentTerms || '',
    termsAndConditions: inv.termsBlock || '',
    cgst: Number(inv.totalCgst || 0),
    sgst: Number(inv.totalSgst || 0),
    igst: Number(inv.totalIgst || 0),
    tdsAmount: Number(inv.tdsAmount || 0),
    netPayable: Number(inv.netPayable || 0),
    items: inv.items?.map(item => ({
      ...item,
      itemDescription: item.description,
      hsnSac: item.hsnCode,
      unit: item.uom,
      cgstAmount: Number(item.cgst),
      sgstAmount: Number(item.sgst),
      igstAmount: Number(item.igst),
      totalBeforeTax: Number(item.taxableValue),
      totalWithGst: Number(item.lineTotal)
    }))
  };
}

function mapAssetToFrontend(asset) {
  if (!asset) return null;
  return {
    ...asset,
    assetCode: asset.assetId,
    assetTagNo: asset.barcode || asset.assetId,
    purchaseValue: Number(asset.purchaseCost),
    condition: asset.status === 'Disposed' ? 'Decommissioned' : 'Good'
  };
}

module.exports = new AssetManagementService();
