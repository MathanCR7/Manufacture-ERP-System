const { z } = require('zod');
const prisma = require('../../database/prisma');

const lineSchema = z.object({
  seqNo: z.number().int().optional(),
  itemType: z.string().optional().default('RAW_MATERIAL'),
  rawMaterialId: z.string().min(1),
  rawMaterialName: z.string().min(1),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  uom: z.string().min(1),
  rate: z.coerce.number().min(0).default(0),
  rateSource: z.string().optional().default('PO_LATEST'),
  rateOverrideReason: z.string().optional().nullable(),
  total: z.coerce.number().optional(),
  isOverhead: z.boolean().optional().default(false)
});

const templateSchema = z.object({
  name: z.string().trim().min(2, 'Template Name is required'),
  baseId: z.string().uuid('Valid Base Name is required'),
  categoryId: z.string().optional().nullable(),
  subCategoryId: z.string().optional().nullable(),
  outputQty: z.coerce.number().positive('Output quantity must be greater than 0').default(2000),
  outputUom: z.string().default('Nos'),
  wastagePct: z.coerce.number().min(0).max(100).default(6.0),
  overheadPct: z.coerce.number().min(0).max(100).default(10.0),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  sopSteps: z.any().optional().nullable(),
  lines: z.array(lineSchema).min(1, 'At least one raw material line is required')
});

// Helper to generate next template code (TPL-0001, TPL-0002...)
async function generateNextTemplateCode() {
  const result = await prisma.$queryRawUnsafe(
    `SELECT code FROM "production_templates" WHERE code LIKE 'TPL-%' ORDER BY code DESC LIMIT 1`
  );
  if (!result || result.length === 0 || !result[0].code) {
    return 'TPL-0001';
  }
  const parts = result[0].code.split('-');
  const num = parseInt(parts[1], 10);
  const nextNum = isNaN(num) ? 1 : num + 1;
  return `TPL-${String(nextNum).padStart(4, '0')}`;
}

// Helper to compute exact Excel financial totals
function calculateTemplateTotals(lines, outputQty, wastagePct, overheadPct) {
  let subTotal = 0;
  const processedLines = lines.map((l, idx) => {
    const qty = Number(l.quantity || 0);
    const rate = Number(l.rate || 0);
    const lineTotal = Number((qty * rate).toFixed(2));
    subTotal += lineTotal;

    return {
      ...l,
      seqNo: l.seqNo !== undefined ? l.seqNo : (idx + 1),
      quantity: qty,
      rate,
      total: lineTotal
    };
  });

  subTotal = Number(subTotal.toFixed(2));
  const wPct = Number(wastagePct || 0);
  const oPct = Number(overheadPct || 0);
  const wastageAmt = Number(((subTotal * wPct) / 100).toFixed(2));
  const overheadAmt = Number(((subTotal * oPct) / 100).toFixed(2));
  const grandTotal = Number((subTotal + wastageAmt + overheadAmt).toFixed(2));
  const outQty = Number(outputQty || 1);
  const costPerUnit = outQty > 0 ? Number((grandTotal / outQty).toFixed(4)) : 0;

  return {
    subTotal,
    wastageAmt,
    overheadAmt,
    grandTotal,
    costPerUnit,
    processedLines
  };
}

class ProductionTemplateController {
  async getAll(req, res, next) {
    try {
      const { baseId, categoryId, status, search } = req.query;

      const where = {
        ...(baseId && { baseId }),
        ...(categoryId && { categoryId }),
        ...(status && status !== 'ALL' && { status }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } }
          ]
        })
      };

      const templates = await prisma.productionTemplate.findMany({
        where,
        include: {
          base: true,
          _count: { select: { lines: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = templates.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        baseId: t.baseId,
        baseName: t.base?.name || 'General Base',
        baseCode: t.base?.code || '',
        categoryId: t.categoryId,
        subCategoryId: t.subCategoryId,
        outputQty: Number(t.outputQty),
        outputUom: t.outputUom,
        lineCount: t._count.lines,
        subTotal: Number(t.subTotal),
        wastagePct: Number(t.wastagePct),
        wastageAmt: Number(t.wastageAmt),
        overheadPct: Number(t.overheadPct),
        overheadAmt: Number(t.overheadAmt),
        grandTotal: Number(t.grandTotal),
        costPerUnit: Number(t.costPerUnit),
        status: t.status,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const template = await prisma.productionTemplate.findUnique({
        where: { id },
        include: {
          base: true,
          lines: {
            orderBy: { seqNo: 'asc' }
          }
        }
      });

      if (!template) {
        return res.status(404).json({ error: 'Production template not found' });
      }

      // Enrich raw materials with alternate UOM metadata from RawMaterial master
      const [allRms, allUoms] = await Promise.all([
        prisma.rawMaterial.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            hasAlternateUom: true,
            alternateUom: true,
            baseUomQty: true,
            alternateUomQty: true,
            conversionFactor: true,
            consumptionUnit: true,
            unitId: true,
            ratePerUnit: true
          }
        }),
        prisma.uOM.findMany({
          select: {
            id: true,
            name: true,
            abbreviation: true
          }
        })
      ]);

      const uomMap = new Map();
      for (const u of allUoms) {
        uomMap.set(u.id, u.abbreviation || u.name);
      }

      const resolveUomLabel = (val, fallback = 'Kg') => {
        if (!val) return fallback;
        if (uomMap.has(val)) return uomMap.get(val);
        // If it looks like a UUID (36 chars with hyphens), fallback
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
          return fallback;
        }
        return val;
      };

      const rmById = new Map();
      const rmByCode = new Map();
      const rmByName = new Map();

      for (const r of allRms) {
        rmById.set(r.id, r);
        if (r.code) rmByCode.set(r.code.toUpperCase(), r);
        if (r.name) rmByName.set(r.name.trim().toLowerCase(), r);
      }

      res.json({
        ...template,
        outputQty: Number(template.outputQty),
        subTotal: Number(template.subTotal),
        wastagePct: Number(template.wastagePct),
        wastageAmt: Number(template.wastageAmt),
        overheadPct: Number(template.overheadPct),
        overheadAmt: Number(template.overheadAmt),
        grandTotal: Number(template.grandTotal),
        costPerUnit: Number(template.costPerUnit),
        lines: template.lines.map(l => {
          let rm = rmById.get(l.rawMaterialId) ||
                   (l.rawMaterialId ? rmByCode.get(l.rawMaterialId.toUpperCase()) : null) ||
                   (l.rawMaterialName ? rmByName.get(l.rawMaterialName.trim().toLowerCase()) : null) || {};

          const hasAlt = Boolean(rm.hasAlternateUom);
          const rawBase = rm.unitId || rm.consumptionUnit || l.uom || 'Kg';
          const baseUom = resolveUomLabel(rawBase, l.uom || 'Kg');
          const altUom = resolveUomLabel(rm.alternateUom, null);
          const bQty = Number(rm.baseUomQty || 1);
          const aQty = Number(rm.alternateUomQty || 1);
          const factor = Number(rm.conversionFactor || (aQty / (bQty || 1)));

          return {
            ...l,
            rawMaterialId: rm.id || l.rawMaterialId,
            rawMaterialCode: rm.code || 'RM',
            rawMaterialName: l.rawMaterialName || rm.name,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            total: Number(l.total),
            hasAlternateUom: hasAlt,
            baseUom: baseUom,
            alternateUom: altUom,
            baseUomQty: bQty,
            alternateUomQty: aQty,
            conversionFactor: factor,
            catalogRate: Number(rm.ratePerUnit || l.rate)
          };
        })
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const data = templateSchema.parse(req.body);

      // Check duplicates in same template
      const rmIdSet = new Set();
      for (const line of data.lines) {
        if (rmIdSet.has(line.rawMaterialId)) {
          return res.status(400).json({ error: `Duplicate raw material "${line.rawMaterialName}" in the same template is not allowed.` });
        }
        rmIdSet.add(line.rawMaterialId);
      }

      const code = await generateNextTemplateCode();
      const totals = calculateTemplateTotals(data.lines, data.outputQty, data.wastagePct, data.overheadPct);

      const template = await prisma.$transaction(async (tx) => {
        const created = await tx.productionTemplate.create({
          data: {
            code,
            name: data.name,
            baseId: data.baseId,
            categoryId: data.categoryId || null,
            subCategoryId: data.subCategoryId || null,
            outputQty: data.outputQty,
            outputUom: data.outputUom,
            wastagePct: data.wastagePct,
            overheadPct: data.overheadPct,
            subTotal: totals.subTotal,
            wastageAmt: totals.wastageAmt,
            overheadAmt: totals.overheadAmt,
            grandTotal: totals.grandTotal,
            costPerUnit: totals.costPerUnit,
            sopSteps: data.sopSteps || null,
            status: data.status || 'ACTIVE',
            createdBy: req.user?.id || null
          }
        });

        for (const line of totals.processedLines) {
          await tx.productionTemplateLine.create({
            data: {
              templateId: created.id,
              seqNo: line.seqNo,
              itemType: line.itemType || 'RAW_MATERIAL',
              rawMaterialId: line.rawMaterialId,
              rawMaterialName: line.rawMaterialName,
              quantity: line.quantity,
              uom: line.uom,
              rate: line.rate,
              rateSource: line.rateSource || 'PO_LATEST',
              rateOverrideReason: line.rateOverrideReason || null,
              total: line.total,
              isOverhead: line.isOverhead || false
            }
          });
        }

        return tx.productionTemplate.findUnique({
          where: { id: created.id },
          include: {
            base: true,
            lines: { orderBy: { seqNo: 'asc' } }
          }
        });
      });

      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = templateSchema.parse(req.body);

      const existing = await prisma.productionTemplate.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Production template not found' });

      // Check duplicates
      const rmIdSet = new Set();
      for (const line of data.lines) {
        if (rmIdSet.has(line.rawMaterialId)) {
          return res.status(400).json({ error: `Duplicate raw material "${line.rawMaterialName}" is not allowed.` });
        }
        rmIdSet.add(line.rawMaterialId);
      }

      const totals = calculateTemplateTotals(data.lines, data.outputQty, data.wastagePct, data.overheadPct);

      const updated = await prisma.$transaction(async (tx) => {
        // Delete old lines
        await tx.productionTemplateLine.deleteMany({
          where: { templateId: id }
        });

        // Update template header
        await tx.productionTemplate.update({
          where: { id },
          data: {
            name: data.name,
            baseId: data.baseId,
            categoryId: data.categoryId || null,
            subCategoryId: data.subCategoryId || null,
            outputQty: data.outputQty,
            outputUom: data.outputUom,
            wastagePct: data.wastagePct,
            overheadPct: data.overheadPct,
            subTotal: totals.subTotal,
            wastageAmt: totals.wastageAmt,
            overheadAmt: totals.overheadAmt,
            grandTotal: totals.grandTotal,
            costPerUnit: totals.costPerUnit,
            sopSteps: data.sopSteps || null,
            status: data.status || 'ACTIVE'
          }
        });

        // Insert updated lines
        for (const line of totals.processedLines) {
          await tx.productionTemplateLine.create({
            data: {
              templateId: id,
              seqNo: line.seqNo,
              itemType: line.itemType || 'RAW_MATERIAL',
              rawMaterialId: line.rawMaterialId,
              rawMaterialName: line.rawMaterialName,
              quantity: line.quantity,
              uom: line.uom,
              rate: line.rate,
              rateSource: line.rateSource || 'PO_LATEST',
              rateOverrideReason: line.rateOverrideReason || null,
              total: line.total,
              isOverhead: line.isOverhead || false
            }
          });
        }

        return tx.productionTemplate.findUnique({
          where: { id },
          include: {
            base: true,
            lines: { orderBy: { seqNo: 'asc' } }
          }
        });
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
      next(err);
    }
  }

  async duplicate(req, res, next) {
    try {
      const { id } = req.params;
      const original = await prisma.productionTemplate.findUnique({
        where: { id },
        include: { lines: { orderBy: { seqNo: 'asc' } } }
      });

      if (!original) return res.status(404).json({ error: 'Template not found' });

      const newCode = await generateNextTemplateCode();
      const newName = `${original.name} (Copy)`;

      const cloned = await prisma.$transaction(async (tx) => {
        const created = await tx.productionTemplate.create({
          data: {
            code: newCode,
            name: newName,
            baseId: original.baseId,
            categoryId: original.categoryId,
            subCategoryId: original.subCategoryId,
            outputQty: original.outputQty,
            outputUom: original.outputUom,
            wastagePct: original.wastagePct,
            overheadPct: original.overheadPct,
            subTotal: original.subTotal,
            wastageAmt: original.wastageAmt,
            overheadAmt: original.overheadAmt,
            grandTotal: original.grandTotal,
            costPerUnit: original.costPerUnit,
            sopSteps: original.sopSteps,
            status: 'ACTIVE',
            createdBy: req.user?.id || null
          }
        });

        for (const l of original.lines) {
          await tx.productionTemplateLine.create({
            data: {
              templateId: created.id,
              seqNo: l.seqNo,
              itemType: l.itemType,
              rawMaterialId: l.rawMaterialId,
              rawMaterialName: l.rawMaterialName,
              quantity: l.quantity,
              uom: l.uom,
              rate: l.rate,
              rateSource: l.rateSource,
              total: l.total,
              isOverhead: l.isOverhead
            }
          });
        }

        return tx.productionTemplate.findUnique({
          where: { id: created.id },
          include: { base: true, lines: true }
        });
      });

      res.status(201).json(cloned);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.productionTemplate.delete({ where: { id } });
      res.json({ message: 'Template deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductionTemplateController();
