const prisma = require('../../database/prisma');

// Helper to format date into DDMMYY
function getDDMMYY(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

class BulkStorageUnitController {
  // GET /api/item-setup/bulk-storage-unit/next-code
  async getNextCode(req, res, next) {
    try {
      const dateStr = getDDMMYY();
      const prefix = `BLK${dateStr}-`;

      const result = await prisma.$queryRawUnsafe(`
        SELECT "unit_code" 
        FROM "bulk_storage_units" 
        WHERE "unit_code" LIKE $1
        ORDER BY "unit_code" DESC
        LIMIT 1
      `, `${prefix}%`);

      let nextSeq = 1;
      if (Array.isArray(result) && result.length > 0) {
        const lastCode = result[0].unit_code;
        const match = lastCode.match(/(\d+)$/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      const nextCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      res.json({ nextCode });
    } catch (err) {
      console.error('Failed to get next bulk unit code:', err);
      next(err);
    }
  }

  // GET /api/item-setup/bulk-storage-unit
  async getAll(req, res, next) {
    try {
      const { search, unitType, status, all } = req.query;

      let whereClause = `WHERE 1=1`;
      const params = [];
      let paramIdx = 1;

      if (unitType && unitType !== 'ALL') {
        whereClause += ` AND "unit_type" = $${paramIdx++}`;
        params.push(unitType);
      }

      if (status && status !== 'ALL') {
        whereClause += ` AND "status" = $${paramIdx++}`;
        params.push(status);
      } else if (all !== '1' && all !== 'true') {
        whereClause += ` AND "status" != 'INACTIVE'`;
      }

      if (search && search.trim()) {
        whereClause += ` AND ("unit_code" ILIKE $${paramIdx} OR "unit_name" ILIKE $${paramIdx} OR "unit_type" ILIKE $${paramIdx} OR "material" ILIKE $${paramIdx} OR "description" ILIKE $${paramIdx})`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      const sql = `
        SELECT 
          "id",
          "unit_code" AS "unitCode",
          "unit_name" AS "unitName",
          "unit_type" AS "unitType",
          "capacity_ml"::FLOAT AS "capacityMl",
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr",
          "tare_weight_kg"::FLOAT AS "tareWeightKg",
          "material",
          "standard_waste_percent"::FLOAT AS "standardWastePercent",
          "description",
          "status",
          COALESCE("linked_raw_materials", '[]'::jsonb) AS "linkedRawMaterials",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "bulk_storage_units"
        ${whereClause}
        ORDER BY 
          CASE WHEN "status" = 'ACTIVE' THEN 1 ELSE 2 END,
          "capacity_ml" ASC,
          "created_at" DESC
      `;

      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      res.json(rows);
    } catch (err) {
      console.error('Failed to get bulk storage units:', err);
      next(err);
    }
  }

  // GET /api/item-setup/bulk-storage-unit/:id
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const sql = `
        SELECT 
          "id",
          "unit_code" AS "unitCode",
          "unit_name" AS "unitName",
          "unit_type" AS "unitType",
          "capacity_ml"::FLOAT AS "capacityMl",
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr",
          "tare_weight_kg"::FLOAT AS "tareWeightKg",
          "material",
          "standard_waste_percent"::FLOAT AS "standardWastePercent",
          "description",
          "status",
          COALESCE("linked_raw_materials", '[]'::jsonb) AS "linkedRawMaterials",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "bulk_storage_units"
        WHERE ${isUuid ? `"id" = $1::uuid` : `"unit_code" = $1`}
        LIMIT 1
      `;

      const rows = await prisma.$queryRawUnsafe(sql, id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Bulk storage unit not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Failed to get bulk storage unit by id:', err);
      next(err);
    }
  }

  // POST /api/item-setup/bulk-storage-unit
  async create(req, res, next) {
    try {
      const body = req.body;

      // Auto generate code if not passed
      let code = (body.unitCode || body.unit_code || '').trim();
      if (!code) {
        const dateStr = getDDMMYY();
        const prefix = `BLK${dateStr}-`;
        const result = await prisma.$queryRawUnsafe(`
          SELECT "unit_code" FROM "bulk_storage_units" WHERE "unit_code" LIKE $1 ORDER BY "unit_code" DESC LIMIT 1
        `, `${prefix}%`);
        let seq = 1;
        if (Array.isArray(result) && result.length > 0) {
          const match = result[0].unit_code.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        code = `${prefix}${String(seq).padStart(4, '0')}`;
      }

      // Check unique code
      const dup = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "bulk_storage_units" WHERE LOWER("unit_code") = LOWER($1) LIMIT 1`,
        code
      );
      if (Array.isArray(dup) && dup.length > 0) {
        return res.status(400).json({ error: `Bulk storage unit with code '${code}' already exists.` });
      }

      const name = (body.unitName || body.unit_name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Bulk unit name is required.' });
      }

      const unitType = body.unitType || body.unit_type || 'Tub';
      const capacityMl = Number(body.capacityMl ?? body.capacity_ml ?? 1000);
      const nominalVolumeLtr = Number(body.nominalVolumeLtr ?? body.nominal_volume_ltr ?? (capacityMl / 1000));
      const tareWeightKg = Number(body.tareWeightKg ?? body.tare_weight_kg ?? 0);
      const material = body.material || 'Food Grade Plastic PP';
      const standardWastePercent = Number(body.standardWastePercent ?? body.standard_waste_percent ?? 0.5);
      const description = body.description || null;
      const status = body.status || 'ACTIVE';
      const linkedRawMaterials = JSON.stringify(body.linkedRawMaterials || body.linked_raw_materials || []);

      const insertSql = `
        INSERT INTO "bulk_storage_units" (
          "unit_code", "unit_name", "unit_type",
          "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
          "material", "standard_waste_percent", "description",
          "status", "linked_raw_materials"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
        )
        RETURNING 
          "id", "unit_code" AS "unitCode", "unit_name" AS "unitName",
          "unit_type" AS "unitType", "capacity_ml"::FLOAT AS "capacityMl",
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr",
          "status", "linked_raw_materials" AS "linkedRawMaterials", "created_at" AS "createdAt"
      `;

      const result = await prisma.$queryRawUnsafe(
        insertSql,
        code, name, unitType,
        capacityMl, nominalVolumeLtr, tareWeightKg,
        material, standardWastePercent, description,
        status, linkedRawMaterials
      );

      res.status(201).json(result[0]);
    } catch (err) {
      console.error('Failed to create bulk storage unit:', err);
      next(err);
    }
  }

  // PUT /api/item-setup/bulk-storage-unit/:id
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const b = req.body;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const capacityMl = b.capacityMl !== undefined ? Number(b.capacityMl) : (b.capacity_ml !== undefined ? Number(b.capacity_ml) : null);
      const nominalVolumeLtr = b.nominalVolumeLtr !== undefined ? Number(b.nominalVolumeLtr) : (b.nominal_volume_ltr !== undefined ? Number(b.nominal_volume_ltr) : (capacityMl !== null ? capacityMl / 1000 : null));

      const updateSql = `
        UPDATE "bulk_storage_units" SET
          "unit_name" = COALESCE($2, "unit_name"),
          "unit_type" = COALESCE($3, "unit_type"),
          "capacity_ml" = COALESCE($4, "capacity_ml"),
          "nominal_volume_ltr" = COALESCE($5, "nominal_volume_ltr"),
          "tare_weight_kg" = COALESCE($6, "tare_weight_kg"),
          "material" = COALESCE($7, "material"),
          "standard_waste_percent" = COALESCE($8, "standard_waste_percent"),
          "description" = COALESCE($9, "description"),
          "status" = COALESCE($10, "status"),
          "linked_raw_materials" = COALESCE($11::jsonb, "linked_raw_materials"),
          "updated_at" = CURRENT_TIMESTAMP
        WHERE ${isUuid ? `"id" = $1::uuid` : `"unit_code" = $1`}
        RETURNING 
          "id", "unit_code" AS "unitCode", "unit_name" AS "unitName",
          "unit_type" AS "unitType", "capacity_ml"::FLOAT AS "capacityMl",
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr",
          "status", "linked_raw_materials" AS "linkedRawMaterials", "updated_at" AS "updatedAt"
      `;

      const linkedJson = b.linkedRawMaterials !== undefined ? JSON.stringify(b.linkedRawMaterials) : null;

      const result = await prisma.$queryRawUnsafe(
        updateSql,
        id,
        b.unitName || b.unit_name || null,
        b.unitType || b.unit_type || null,
        capacityMl,
        nominalVolumeLtr,
        b.tareWeightKg !== undefined ? Number(b.tareWeightKg) : null,
        b.material || null,
        b.standardWastePercent !== undefined ? Number(b.standardWastePercent) : null,
        b.description !== undefined ? b.description : null,
        b.status || null,
        linkedJson
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Bulk storage unit not found' });
      }

      res.json(result[0]);
    } catch (err) {
      console.error('Failed to update bulk storage unit:', err);
      next(err);
    }
  }

  // PATCH /api/item-setup/bulk-storage-unit/:id/status
  async toggleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      const sql = `
        UPDATE "bulk_storage_units"
        SET 
          "status" = CASE WHEN "status" = 'ACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE ${isUuid ? `"id" = $1::uuid` : `"unit_code" = $1`}
        RETURNING "id", "unit_code" AS "unitCode", "status", "updated_at" AS "updatedAt"
      `;

      const result = await prisma.$queryRawUnsafe(sql, id);
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Bulk storage unit not found' });
      }

      res.json(result[0]);
    } catch (err) {
      console.error('Failed to toggle bulk unit status:', err);
      next(err);
    }
  }

  // DELETE /api/item-setup/bulk-storage-unit/:id
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      await prisma.$queryRawUnsafe(`
        DELETE FROM "bulk_storage_units" 
        WHERE ${isUuid ? `"id" = $1::uuid` : `"unit_code" = $1`}
      `, id);

      res.json({ message: 'Bulk storage unit deleted successfully.', deleted: true });
    } catch (err) {
      console.error('Failed to delete bulk storage unit:', err);
      next(err);
    }
  }
}

module.exports = new BulkStorageUnitController();
