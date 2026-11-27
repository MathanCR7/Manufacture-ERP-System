const prisma = require('../../database/prisma');
const { z } = require('zod');

// Helper to format date into DDMMYY
function getDDMMYY(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

class MouldMasterController {
  // GET /api/item-setup/mould-master/next-code
  async getNextCode(req, res, next) {
    try {
      const dateStr = getDDMMYY();
      const prefix = `MLD${dateStr}-`;

      const result = await prisma.$queryRawUnsafe(`
        SELECT "mould_code" 
        FROM "production_moulds" 
        WHERE "mould_code" LIKE $1
        ORDER BY "mould_code" DESC
        LIMIT 1
      `, `${prefix}%`);

      let nextSeq = 1;
      if (Array.isArray(result) && result.length > 0) {
        const lastCode = result[0].mould_code;
        const match = lastCode.match(/(\d+)$/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      const nextCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      res.json({ nextCode });
    } catch (err) {
      console.error('Failed to get next mould code:', err);
      next(err);
    }
  }

  // GET /api/item-setup/mould-master
  async getAll(req, res, next) {
    try {
      const { search, category, status, specificationStatus, all } = req.query;

      let whereClause = `WHERE 1=1`;
      const params = [];
      let paramIdx = 1;

      if (category && category !== 'ALL') {
        whereClause += ` AND "mould_category" = $${paramIdx++}`;
        params.push(category);
      }

      if (specificationStatus && specificationStatus !== 'ALL') {
        whereClause += ` AND "specification_status" = $${paramIdx++}`;
        params.push(specificationStatus);
      }

      if (status && status !== 'ALL') {
        whereClause += ` AND "status" = $${paramIdx++}`;
        params.push(status);
      } else if (all !== '1' && all !== 'true') {
        whereClause += ` AND "status" != 'INACTIVE'`;
      }

      if (search && search.trim()) {
        whereClause += ` AND ("mould_code" ILIKE $${paramIdx} OR "mould_name" ILIKE $${paramIdx} OR "model_number" ILIKE $${paramIdx} OR "supplier_name" ILIKE $${paramIdx} OR "material" ILIKE $${paramIdx})`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      const sql = `
        SELECT 
          "id",
          "mould_code" AS "mouldCode",
          "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory",
          "model_number" AS "modelNumber",
          "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount",
          "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "tray_length_mm"::FLOAT AS "trayLengthMm",
          "tray_width_mm"::FLOAT AS "trayWidthMm",
          "tray_height_mm"::FLOAT AS "trayHeightMm",
          "cavity_length_mm"::FLOAT AS "cavityLengthMm",
          "cavity_width_mm"::FLOAT AS "cavityWidthMm",
          "cavity_depth_mm"::FLOAT AS "cavityDepthMm",
          "dimension_text" AS "dimensionText",
          "material",
          "machine_type" AS "machineType",
          "specification_status" AS "specificationStatus",
          "supplier_id" AS "supplierId",
          "supplier_name" AS "supplierName",
          "status",
          COALESCE("linked_raw_materials", '[]'::jsonb) AS "linkedRawMaterials",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "production_moulds"
        ${whereClause}
        ORDER BY 
          CASE WHEN "status" = 'ACTIVE' THEN 1 ELSE 2 END,
          "created_at" DESC,
          "mould_code" ASC
      `;

      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      res.json(rows);
    } catch (err) {
      console.error('Failed to get moulds:', err);
      next(err);
    }
  }

  // GET /api/item-setup/mould-master/:id
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const sql = `
        SELECT 
          "id",
          "mould_code" AS "mouldCode",
          "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory",
          "model_number" AS "modelNumber",
          "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount",
          "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "tray_length_mm"::FLOAT AS "trayLengthMm",
          "tray_width_mm"::FLOAT AS "trayWidthMm",
          "tray_height_mm"::FLOAT AS "trayHeightMm",
          "cavity_length_mm"::FLOAT AS "cavityLengthMm",
          "cavity_width_mm"::FLOAT AS "cavityWidthMm",
          "cavity_depth_mm"::FLOAT AS "cavityDepthMm",
          "dimension_text" AS "dimensionText",
          "material",
          "machine_type" AS "machineType",
          "specification_status" AS "specificationStatus",
          "supplier_id" AS "supplierId",
          "supplier_name" AS "supplierName",
          "status",
          COALESCE("linked_raw_materials", '[]'::jsonb) AS "linkedRawMaterials",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "production_moulds"
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        LIMIT 1
      `;

      const rows = await prisma.$queryRawUnsafe(sql, id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Mould master not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Failed to get mould by id:', err);
      next(err);
    }
  }

  // POST /api/item-setup/mould-master
  async create(req, res, next) {
    try {
      const body = req.body;

      // Auto generate code if not passed
      let code = (body.mouldCode || body.mould_code || '').trim();
      if (!code) {
        const dateStr = getDDMMYY();
        const prefix = `MLD${dateStr}-`;
        const result = await prisma.$queryRawUnsafe(`
          SELECT "mould_code" FROM "production_moulds" WHERE "mould_code" LIKE $1 ORDER BY "mould_code" DESC LIMIT 1
        `, `${prefix}%`);
        let seq = 1;
        if (Array.isArray(result) && result.length > 0) {
          const match = result[0].mould_code.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        code = `${prefix}${String(seq).padStart(4, '0')}`;
      }

      // Check unique code
      const dup = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "production_moulds" WHERE LOWER("mould_code") = LOWER($1) LIMIT 1`,
        code
      );
      if (Array.isArray(dup) && dup.length > 0) {
        return res.status(400).json({ error: `Mould with code '${code}' already exists.` });
      }

      const name = (body.mouldName || body.mould_name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Mould name is required.' });
      }

      const category = body.mouldCategory || body.mould_category || 'STICK';
      const modelNumber = body.modelNumber || body.model_number || null;
      const capacityMl = Number(body.capacityMl ?? body.capacity_ml ?? 0);
      const cavityCount = parseInt(body.cavityCount ?? body.cavity_count ?? 1, 10);
      const trayLengthMm = body.trayLengthMm ? Number(body.trayLengthMm) : null;
      const trayWidthMm = body.trayWidthMm ? Number(body.trayWidthMm) : null;
      const trayHeightMm = body.trayHeightMm ? Number(body.trayHeightMm) : null;
      const cavityLengthMm = body.cavityLengthMm ? Number(body.cavityLengthMm) : null;
      const cavityWidthMm = body.cavityWidthMm ? Number(body.cavityWidthMm) : null;
      const cavityDepthMm = body.cavityDepthMm ? Number(body.cavityDepthMm) : null;
      const dimensionText = body.dimensionText || body.dimension_text || null;
      const material = body.material || 'Stainless Steel 304';
      const machineType = body.machineType || body.machine_type || 'Brine tank line';
      const specificationStatus = body.specificationStatus || body.specification_status || 'VERIFIED';
      const supplierName = body.supplierName || body.supplier_name || 'Satnam Group';
      const status = body.status || 'ACTIVE';
      const linkedRawMaterials = JSON.stringify(body.linkedRawMaterials || body.linked_raw_materials || []);

      const insertSql = `
        INSERT INTO "production_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "tray_length_mm", "tray_width_mm", "tray_height_mm",
          "cavity_length_mm", "cavity_width_mm", "cavity_depth_mm",
          "dimension_text", "material", "machine_type",
          "specification_status", "supplier_name", "status", "linked_raw_materials"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb
        )
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "status", "linked_raw_materials" AS "linkedRawMaterials", "created_at" AS "createdAt"
      `;

      const result = await prisma.$queryRawUnsafe(
        insertSql,
        code, name, category, modelNumber,
        capacityMl, cavityCount,
        trayLengthMm, trayWidthMm, trayHeightMm,
        cavityLengthMm, cavityWidthMm, cavityDepthMm,
        dimensionText, material, machineType,
        specificationStatus, supplierName, status, linkedRawMaterials
      );

      res.status(201).json(result[0]);
    } catch (err) {
      console.error('Failed to create mould:', err);
      next(err);
    }
  }

  // PUT /api/item-setup/mould-master/:id
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const b = req.body;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const updateSql = `
        UPDATE "production_moulds" SET
          "mould_name" = COALESCE($2, "mould_name"),
          "mould_category" = COALESCE($3, "mould_category"),
          "model_number" = COALESCE($4, "model_number"),
          "capacity_ml" = COALESCE($5, "capacity_ml"),
          "cavity_count" = COALESCE($6, "cavity_count"),
          "tray_length_mm" = COALESCE($7, "tray_length_mm"),
          "tray_width_mm" = COALESCE($8, "tray_width_mm"),
          "tray_height_mm" = COALESCE($9, "tray_height_mm"),
          "cavity_length_mm" = COALESCE($10, "cavity_length_mm"),
          "cavity_width_mm" = COALESCE($11, "cavity_width_mm"),
          "cavity_depth_mm" = COALESCE($12, "cavity_depth_mm"),
          "dimension_text" = COALESCE($13, "dimension_text"),
          "material" = COALESCE($14, "material"),
          "machine_type" = COALESCE($15, "machine_type"),
          "specification_status" = COALESCE($16, "specification_status"),
          "supplier_name" = COALESCE($17, "supplier_name"),
          "status" = COALESCE($18, "status"),
          "linked_raw_materials" = COALESCE($19::jsonb, "linked_raw_materials"),
          "updated_at" = CURRENT_TIMESTAMP
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "status", "linked_raw_materials" AS "linkedRawMaterials", "updated_at" AS "updatedAt"
      `;

      const linkedJson = b.linkedRawMaterials !== undefined ? JSON.stringify(b.linkedRawMaterials) : null;

      const result = await prisma.$queryRawUnsafe(
        updateSql,
        id,
        b.mouldName || b.mould_name || null,
        b.mouldCategory || b.mould_category || null,
        b.modelNumber || b.model_number || null,
        b.capacityMl !== undefined ? Number(b.capacityMl) : null,
        b.cavityCount !== undefined ? parseInt(b.cavityCount, 10) : null,
        b.trayLengthMm !== undefined ? Number(b.trayLengthMm) : null,
        b.trayWidthMm !== undefined ? Number(b.trayWidthMm) : null,
        b.trayHeightMm !== undefined ? Number(b.trayHeightMm) : null,
        b.cavityLengthMm !== undefined ? Number(b.cavityLengthMm) : null,
        b.cavityWidthMm !== undefined ? Number(b.cavityWidthMm) : null,
        b.cavityDepthMm !== undefined ? Number(b.cavityDepthMm) : null,
        b.dimensionText || b.dimension_text || null,
        b.material || null,
        b.machineType || b.machine_type || null,
        b.specificationStatus || b.specification_status || null,
        b.supplierName || b.supplier_name || null,
        b.status || null,
        linkedJson
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Mould master not found' });
      }

      res.json(result[0]);
    } catch (err) {
      console.error('Failed to update mould:', err);
      next(err);
    }
  }

  // PATCH /api/item-setup/mould-master/:id/status
  async toggleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const sql = `
        UPDATE "production_moulds"
        SET 
          "status" = CASE WHEN "status" = 'ACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        RETURNING "id", "mould_code" AS "mouldCode", "status", "updated_at" AS "updatedAt"
      `;

      const result = await prisma.$queryRawUnsafe(sql, id);
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Mould not found' });
      }

      res.json(result[0]);
    } catch (err) {
      console.error('Failed to toggle mould status:', err);
      next(err);
    }
  }

  // DELETE /api/item-setup/mould-master/:id
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      // Check if used in production batches
      const inBatch = await prisma.$queryRawUnsafe(`
        SELECT "id" FROM "production_batches" 
        WHERE "mould_id" = $1 OR "mould_code" = $1
        LIMIT 1
      `, id).catch(() => []);

      if (Array.isArray(inBatch) && inBatch.length > 0) {
        // Soft delete / set INACTIVE
        await prisma.$queryRawUnsafe(`
          UPDATE "production_moulds" SET "status" = 'INACTIVE', "updated_at" = CURRENT_TIMESTAMP
          WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        `, id);
        return res.json({ message: 'Mould is referenced by production batches. It has been marked INACTIVE.', softDeleted: true });
      }

      await prisma.$queryRawUnsafe(`
        DELETE FROM "production_moulds" 
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
      `, id);

      res.json({ message: 'Mould deleted successfully.', deleted: true });
    } catch (err) {
      console.error('Failed to delete mould:', err);
      next(err);
    }
  }
}

module.exports = new MouldMasterController();
