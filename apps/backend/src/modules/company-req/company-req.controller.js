const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const prisma = require('../../database/prisma');

// Ensure upload directory exists for attachments
const UPLOAD_DIR = path.join(__dirname, '../../../uploads/company-req');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Helper to save base64 data to disk and return public URL
 */
function saveAttachmentToDisk(fileObj, index = 0) {
  if (!fileObj || typeof fileObj !== 'object') return fileObj;
  const { name = 'attachment', url, data } = fileObj;
  const content = data || url;

  if (content && typeof content === 'string' && content.startsWith('data:')) {
    try {
      const matches = content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split('/')[1]?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const buffer = Buffer.from(matches[2], 'base64');
        const safeName = (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `att_${Date.now()}_${index}_${safeName.endsWith('.' + ext) ? safeName : safeName + '.' + ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filePath, buffer);

        return {
          id: `att_${Date.now()}_${index}`,
          name: name || filename,
          url: `/uploads/company-req/${filename}`,
          size: buffer.length,
          type: matches[1],
          uploadedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('[CompanyReq] Failed to save attachment to disk:', err);
    }
  }

  return {
    id: fileObj.id || `att_${Date.now()}_${index}`,
    name: fileObj.name || `Att ${index + 1}`,
    url: fileObj.url || '',
    size: fileObj.size || 0,
    type: fileObj.type || 'application/octet-stream',
    uploadedAt: fileObj.uploadedAt || new Date().toISOString()
  };
}

/**
 * Auto-ensure industry type is registered in IndustryTypeMaster without duplication
 */
async function ensureIndustryTypeMaster(industryName, user) {
  if (!industryName || typeof industryName !== 'string' || !industryName.trim()) return null;
  const trimmed = industryName.trim();
  try {
    const existing = await prisma.industryTypeMaster.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    });
    if (existing) {
      if (!existing.isActive) {
        return await prisma.industryTypeMaster.update({
          where: { id: existing.id },
          data: { isActive: true }
        });
      }
      return existing;
    }
    return await prisma.industryTypeMaster.create({
      data: {
        name: trimmed,
        isActive: true,
        createdBy: user?.id || null,
        creatorName: user?.name || user?.username || 'Auto-registered'
      }
    });
  } catch (err) {
    console.error('[CompanyReq] ensureIndustryTypeMaster error:', err.message);
    return null;
  }
}

// Zod Schema for validation
const companyReqSchema = z.object({
  industryType: z.string().trim().min(1, 'Industry Type is required'),
  companyName: z.string().trim().min(1, 'Company Name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  website: z.string().trim().nullable().optional(),
  type: z.enum(['Manufacture', 'Trader', 'Retailer', 'Supplier', 'Others'], {
    errorMap: () => ({ message: 'Type must be one of: Manufacture, Trader, Retailer, Supplier, Others' })
  }),
  contactPerson: z.string().trim().min(1, 'Contact Person is required'),
  contactNo: z.string().trim().min(1, 'Contact No is required'),
  additionalContacts: z.array(z.string().trim()).optional().default([]),
  remarks: z.string().trim().nullable().optional(),
  attachments: z.array(z.any()).optional().default([]),
});

/**
 * GET /api/company-req
 * Fetch list with Search, Filter by Type and Industry, Sorting and Pagination
 */
exports.getCompanyReqList = async (req, res, next) => {
  try {
    const {
      search = '',
      type = 'ALL',
      industryType = 'ALL',
      sortBy = 'recent',
      page = 1,
      limit = 50
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Build Where filter
    const where = {};

    if (type && type !== 'ALL') {
      where.type = { equals: type, mode: 'insensitive' };
    }

    if (industryType && industryType !== 'ALL') {
      where.industryType = { equals: industryType, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { companyName: { contains: term, mode: 'insensitive' } },
        { industryType: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
        { website: { contains: term, mode: 'insensitive' } },
        { type: { contains: term, mode: 'insensitive' } },
        { contactPerson: { contains: term, mode: 'insensitive' } },
        { contactNo: { contains: term, mode: 'insensitive' } },
        { remarks: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Determine Sort Order
    let orderBy = { createdAt: 'desc' };
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'name_asc':
        orderBy = { companyName: 'asc' };
        break;
      case 'name_desc':
        orderBy = { companyName: 'desc' };
        break;
      case 'industry_asc':
        orderBy = { industryType: 'asc' };
        break;
      case 'industry_desc':
        orderBy = { industryType: 'desc' };
        break;
      case 'type_asc':
        orderBy = { type: 'asc' };
        break;
      case 'type_desc':
        orderBy = { type: 'desc' };
        break;
      case 'person_asc':
        orderBy = { contactPerson: 'asc' };
        break;
      case 'person_desc':
        orderBy = { contactPerson: 'desc' };
        break;
      case 'recent':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [total, data, allItems] = await Promise.all([
      prisma.companyReqForm.count({ where }),
      prisma.companyReqForm.findMany({
        where,
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.companyReqForm.findMany({
        select: { type: true, industryType: true }
      })
    ]);

    // Compute stats
    const stats = {
      total: allItems.length,
      manufactureCount: allItems.filter(i => (i.type || '').toLowerCase() === 'manufacture').length,
      traderCount: allItems.filter(i => (i.type || '').toLowerCase() === 'trader').length,
      retailerCount: allItems.filter(i => (i.type || '').toLowerCase() === 'retailer').length,
      supplierCount: allItems.filter(i => (i.type || '').toLowerCase() === 'supplier').length,
      othersCount: allItems.filter(i => (i.type || '').toLowerCase() === 'others').length,
    };

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper to ensure an Industry Type exists in IndustryTypeMaster so duplicates are never created
 */
async function ensureIndustryTypeMaster(name, user) {
  if (!name || typeof name !== 'string') return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const existing = await prisma.industryTypeMaster.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    });
    if (!existing) {
      await prisma.industryTypeMaster.create({
        data: {
          name: trimmed,
          createdBy: user?.id || null,
          creatorName: user?.name || user?.username || 'Admin'
        }
      });
    }
  } catch (err) {
    console.warn('[IndustryMaster] Ensure master record notice:', err.message);
  }
}

/**
 * GET /api/company-req/industries
 * Fetch unique list of industry types from Master table with search & deduplication
 */
exports.getDistinctIndustries = async (req, res, next) => {
  try {
    const { search = '' } = req.query;

    // 1. Fetch from IndustryTypeMaster
    let masterList = await prisma.industryTypeMaster.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    // If master is completely empty, populate common default industries
    if (masterList.length === 0) {
      const defaultIndustries = [
        'Milk Supplier',
        'Poly Bag Supply',
        'Tissue Supply',
        'Packing',
        'Chemicals & Additives',
        'Food & Beverages',
        'Hardware & Spares',
        'Printing & Labels',
        'Logistics & Transport',
        'Raw Material Supplier'
      ];

      for (const defName of defaultIndustries) {
        try {
          await prisma.industryTypeMaster.create({
            data: { name: defName, creatorName: 'System' }
          });
        } catch (_) {}
      }

      masterList = await prisma.industryTypeMaster.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    }

    // 2. Fetch distinct from CompanyReqForm to ensure 100% synchronization
    const reqFormList = await prisma.companyReqForm.findMany({
      select: { industryType: true },
      distinct: ['industryType']
    });

    // Merge & deduplicate strictly case-insensitively
    const seen = new Set();
    const result = [];

    for (const m of masterList) {
      const key = m.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          id: m.id,
          name: m.name,
          description: m.description || null
        });
      }
    }

    for (const r of reqFormList) {
      if (!r.industryType) continue;
      const key = r.industryType.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        try {
          const newMaster = await prisma.industryTypeMaster.create({
            data: { name: r.industryType.trim(), creatorName: 'Auto-sync' }
          });
          result.push({ id: newMaster.id, name: newMaster.name, description: null });
        } catch (_) {
          result.push({ id: `item-${result.length}`, name: r.industryType.trim(), description: null });
        }
      }
    }

    // Filter by search query if provided
    let filtered = result;
    if (search && search.trim()) {
      const s = search.toLowerCase().trim();
      filtered = result.filter(item => item.name.toLowerCase().includes(s));
    }

    // Sort alphabetically A-Z
    filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    res.json({
      status: 'success',
      data: filtered,
      industries: filtered.map(i => i.name)
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/company-req/industries
 * Create a new Industry Type Master record (strictly prevented duplicates)
 */
exports.createIndustryType = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Industry Type name is required' });
    }

    const trimmed = name.trim();

    // Check if an industry with the same name already exists (case-insensitive)
    const existing = await prisma.industryTypeMaster.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    });

    if (existing) {
      return res.status(200).json({
        status: 'success',
        message: 'Industry Type already exists in master',
        data: existing,
        isExisting: true
      });
    }

    const created = await prisma.industryTypeMaster.create({
      data: {
        name: trimmed,
        description: description?.trim() || null,
        createdBy: req.user?.id || null,
        creatorName: req.user?.name || req.user?.username || 'Admin'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Industry Type added to master successfully',
      data: created,
      isExisting: false
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await prisma.industryTypeMaster.findFirst({
        where: { name: { equals: req.body?.name?.trim(), mode: 'insensitive' } }
      });
      return res.status(200).json({
        status: 'success',
        message: 'Industry Type already exists',
        data: existing,
        isExisting: true
      });
    }
    next(err);
  }
};

/**
 * GET /api/company-req/:id
 * Get single Company Requirement Form by ID
 */
exports.getCompanyReqById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await prisma.companyReqForm.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: 'Company Requirement record not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/company-req
 * Create new Company Requirement Form
 */
exports.createCompanyReq = async (req, res, next) => {
  try {
    const parsed = companyReqSchema.parse(req.body);

    // Process attachments
    const processedAttachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.map((att, idx) => saveAttachmentToDisk(att, idx))
      : [];

    // Filter valid additional contact numbers
    const cleanAdditionalContacts = Array.isArray(parsed.additionalContacts)
      ? parsed.additionalContacts.filter(c => typeof c === 'string' && c.trim().length > 0)
      : [];

    const record = await prisma.companyReqForm.create({
      data: {
        industryType: parsed.industryType.trim(),
        companyName: parsed.companyName.toUpperCase().trim(),
        address: parsed.address.trim(),
        website: parsed.website ? parsed.website.trim() : null,
        type: parsed.type,
        contactPerson: parsed.contactPerson.toUpperCase().trim(),
        contactNo: parsed.contactNo.trim(),
        additionalContacts: cleanAdditionalContacts,
        remarks: parsed.remarks ? parsed.remarks.trim() : null,
        attachments: processedAttachments,
        createdBy: req.user?.id || null,
        creatorName: req.user?.name || req.user?.email || null,
      }
    });

    // Auto-ensure industry type is registered in IndustryTypeMaster without duplication
    await ensureIndustryTypeMaster(parsed.industryType, req.user);

    // Audit Log
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || 'system',
          action: 'CREATE',
          tableName: 'CompanyReqForm',
          recordId: record.id,
          newValue: record,
          ip: clientIp,
        }
      });
    } catch (auditErr) {
      console.error('Audit log failed:', auditErr.message);
    }

    res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error', details: err.errors });
    }
    next(err);
  }
};

/**
 * PUT /api/company-req/:id
 * Update existing Company Requirement Form
 */
exports.updateCompanyReq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.companyReqForm.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Company Requirement record not found' });
    }

    const parsed = companyReqSchema.parse(req.body);

    const processedAttachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.map((att, idx) => saveAttachmentToDisk(att, idx))
      : [];

    const cleanAdditionalContacts = Array.isArray(parsed.additionalContacts)
      ? parsed.additionalContacts.filter(c => typeof c === 'string' && c.trim().length > 0)
      : [];

    const updated = await prisma.companyReqForm.update({
      where: { id },
      data: {
        industryType: parsed.industryType.trim(),
        companyName: parsed.companyName.toUpperCase().trim(),
        address: parsed.address.trim(),
        website: parsed.website ? parsed.website.trim() : null,
        type: parsed.type,
        contactPerson: parsed.contactPerson.toUpperCase().trim(),
        contactNo: parsed.contactNo.trim(),
        additionalContacts: cleanAdditionalContacts,
        remarks: parsed.remarks ? parsed.remarks.trim() : null,
        attachments: processedAttachments,
      }
    });

    // Auto-ensure industry type is registered in IndustryTypeMaster without duplication
    await ensureIndustryTypeMaster(parsed.industryType, req.user);

    // Audit Log
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || 'system',
          action: 'UPDATE',
          tableName: 'CompanyReqForm',
          recordId: id,
          oldValue: existing,
          newValue: updated,
          ip: clientIp,
        }
      });
    } catch (auditErr) {
      console.error('Audit log failed:', auditErr.message);
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error', details: err.errors });
    }
    next(err);
  }
};

/**
 * DELETE /api/company-req/:id
 * Delete a Company Requirement Form
 */
exports.deleteCompanyReq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.companyReqForm.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Company Requirement record not found' });
    }

    await prisma.companyReqForm.delete({ where: { id } });

    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || 'system',
          action: 'DELETE',
          tableName: 'CompanyReqForm',
          recordId: id,
          oldValue: existing,
          ip: clientIp,
        }
      });
    } catch (auditErr) {
      console.error('Audit log failed:', auditErr.message);
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    next(err);
  }
};
