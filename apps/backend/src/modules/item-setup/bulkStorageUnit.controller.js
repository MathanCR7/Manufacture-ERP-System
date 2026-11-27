const prisma = require('../../database/prisma');

// Helper to format date into DDMMYY
function getDDMMYY(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

let bulkTableEnsured = false;
async function ensureBulkTable() {
  if (bulkTableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "bulk_storage_units" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "unit_code" VARCHAR(50) UNIQUE NOT NULL,
        "unit_name" VARCHAR(150) NOT NULL,
        "unit_type" VARCHAR(50) NOT NULL DEFAULT 'Gallon',
        "capacity_ml" NUMERIC(12, 2) NOT NULL DEFAULT 2000,
        "nominal_volume_ltr" NUMERIC(10, 3) NOT NULL DEFAULT 2.000,
        "tare_weight_kg" NUMERIC(10, 3) DEFAULT 0.08,
        "material" VARCHAR(100) DEFAULT 'Food Grade Polypropylene',
        "standard_waste_percent" NUMERIC(5, 2) DEFAULT 0.5,
        "description" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "linked_raw_materials" JSONB DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE "bulk_storage_units" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;
    `);

    const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::INT AS count FROM "bulk_storage_units"`).catch(() => [{ count: 0 }]);
    const count = countRes?.[0]?.count || 0;
    if (count === 0) {
      await seedDefaultBulkUnits();
    }

    bulkTableEnsured = true;
  } catch (err) {
    console.error('[BulkStorageUnitController] ensureBulkTable error:', err?.message || err);
  }
}

async function seedDefaultBulkUnits() {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        OR: [
          { code: { in: ['RM-00121', 'RM-00138'] } },
          { name: { contains: 'GALLON', mode: 'insensitive' } },
          { name: { contains: 'PET', mode: 'insensitive' } }
        ]
      }
    }).catch(() => []);

    const getRm = (code, fallbackName) => {
      const found = rawMaterials.find(r => r.code === code) || rawMaterials.find(r => r.name.toLowerCase().includes(fallbackName.toLowerCase()));
      return {
        rawMaterialId: found ? found.id : null,
        rmCode: found ? found.code : code,
        rmName: found ? found.name : fallbackName,
        uom: found ? (found.consumptionUnit || found.uom || 'pcs') : 'pcs'
      };
    };

    const rmGallonBox = getRm('RM-00121', 'GALLON BOX 4LTR');
    const rmPet5L = getRm('RM-00138', 'PET 5LTR CAN');

    const defaultUnits = [
      {
        unit_code: 'BLK-1000ML',
        unit_name: 'Liter (1,000 ml)',
        unit_type: 'Liter',
        capacity_ml: 1000,
        nominal_volume_ltr: 1.0,
        tare_weight_kg: 0.05,
        material: 'Food Grade Plastic PP Tub',
        standard_waste_percent: 0.5,
        description: 'Standard 1 Litre Ice Cream Container / Tub',
        status: 'ACTIVE',
        linked_raw_materials: [
          { rawMaterialId: null, rmCode: 'PKG-TUB-1L', rmName: '1L Ice Cream Tub & Lid', uom: 'pcs', quantityPerUnit: 1, role: 'Container Body / Tub' }
        ]
      },
      {
        unit_code: 'BLK-2000ML',
        unit_name: 'Gallon (2,000 ml)',
        unit_type: 'Gallon',
        capacity_ml: 2000,
        nominal_volume_ltr: 2.0,
        tare_weight_kg: 0.09,
        material: 'Food Grade Plastic Gallon Tub',
        standard_waste_percent: 0.5,
        description: 'Standard 2 Litre / Half Gallon Bulk Container',
        status: 'ACTIVE',
        linked_raw_materials: [
          { ...rmGallonBox, quantityPerUnit: 0.5, role: 'Gallon Box' },
          { rawMaterialId: null, rmCode: 'PKG-GAL-2L', rmName: '2L Gallon Tub with Handle', uom: 'pcs', quantityPerUnit: 1, role: 'Container Body / Tub' }
        ]
      },
      {
        unit_code: 'BLK-5000ML',
        unit_name: 'Tub (5 Litres)',
        unit_type: 'Tub',
        capacity_ml: 5000,
        nominal_volume_ltr: 5.0,
        tare_weight_kg: 0.18,
        material: 'Commercial Food Grade HDPE Tub',
        standard_waste_percent: 0.5,
        description: '5 Litres Bulk Catering / Parlour Tub',
        status: 'ACTIVE',
        linked_raw_materials: [
          { ...rmPet5L, quantityPerUnit: 1, role: 'Container Body / Tub' }
        ]
      },
      {
        unit_code: 'BLK-20000ML',
        unit_name: 'Can (20 Litres)',
        unit_type: 'Can',
        capacity_ml: 20000,
        nominal_volume_ltr: 20.0,
        tare_weight_kg: 0.65,
        material: 'Commercial Stainless Steel / Heavy-Duty HDPE Can',
        standard_waste_percent: 0.2,
        description: '20 Litres Commercial Ice Cream Can for Dispensing & Parlours',
        status: 'ACTIVE',
        linked_raw_materials: [
          { rawMaterialId: null, rmCode: 'PKG-CAN-20L', rmName: '20L Stainless Steel Canister', uom: 'pcs', quantityPerUnit: 1, role: 'Can Body' }
        ]
      }
    ];

    for (const u of defaultUnits) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "bulk_storage_units" (
          "unit_code", "unit_name", "unit_type", "capacity_ml", "nominal_volume_ltr",
          "tare_weight_kg", "material", "standard_waste_percent", "description",
          "status", "linked_raw_materials"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
        )
        ON CONFLICT ("unit_code") DO NOTHING;
      `, u.unit_code, u.unit_name, u.unit_type, u.capacity_ml, u.nominal_volume_ltr,
         u.tare_weight_kg, u.material, u.standard_waste_percent, u.description,
         u.status, JSON.stringify(u.linked_raw_materials));
    }
  } catch (err) {
    console.error('[BulkStorageUnitController] seedDefaultBulkUnits error:', err?.message || err);
  }
}

class BulkStorageUnitController {
  // GET /api/item-setup/bulk-storage-unit/next-code
  async getNextCode(req, res, next) {
    try {
      await ensureBulkTable();
      const dateStr = getDDMMYY();
      const prefix = `BLK${dateStr}-`;

      let result = [];
      try {
        result = await prisma.$queryRawUnsafe(`
          SELECT "unit_code" 
          FROM "bulk_storage_units" 
          WHERE "unit_code" LIKE $1
          ORDER BY "unit_code" DESC
          LIMIT 1
        `, `${prefix}%`);
      } catch (err) {
        bulkTableEnsured = false;
        await ensureBulkTable();
        result = await prisma.$queryRawUnsafe(`
          SELECT "unit_code" FROM "bulk_storage_units" WHERE "unit_code" LIKE $1 ORDER BY "unit_code" DESC LIMIT 1
        `, `${prefix}%`).catch(() => []);
      }

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
      const dateStr = getDDMMYY();
      res.json({ nextCode: `BLK${dateStr}-0001` });
    }
  }

  // GET /api/item-setup/bulk-storage-unit
  async getAll(req, res, next) {
    try {
      await ensureBulkTable();
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

      let rows = [];
      try {
        rows = await prisma.$queryRawUnsafe(sql, ...params);
      } catch (queryErr) {
        console.warn('[BulkStorageUnitController] query failed, retrying after table ensure:', queryErr?.message);
        bulkTableEnsured = false;
        await ensureBulkTable();
        rows = await prisma.$queryRawUnsafe(sql, ...params).catch(() => []);
      }

      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Failed to get bulk storage units:', err);
      res.json([]);
    }
  }

  // GET /api/item-setup/bulk-storage-unit/:id
  async getById(req, res, next) {
    try {
      await ensureBulkTable();
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

      const rows = await prisma.$queryRawUnsafe(sql, id).catch(() => []);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Bulk storage unit not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Failed to get bulk unit by id:', err);
      res.status(404).json({ error: 'Bulk unit not found' });
    }
  }

  // POST /api/item-setup/bulk-storage-unit
  async create(req, res, next) {
    try {
      await ensureBulkTable();
      const body = req.body;

      // Auto generate code if not passed
      let code = (body.unitCode || body.unit_code || '').trim();
      if (!code) {
        const dateStr = getDDMMYY();
        const prefix = `BLK${dateStr}-`;
        const result = await prisma.$queryRawUnsafe(`
          SELECT "unit_code" FROM "bulk_storage_units" WHERE "unit_code" LIKE $1 ORDER BY "unit_code" DESC LIMIT 1
        `, `${prefix}%`).catch(() => []);
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
      ).catch(() => []);
      if (Array.isArray(dup) && dup.length > 0) {
        return res.status(400).json({ error: `Bulk storage unit with code '${code}' already exists.` });
      }

      const name = (body.unitName || body.unit_name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Unit name is required.' });
      }

      const unitType = body.unitType || body.unit_type || 'Gallon';
      const capacityMl = Number(body.capacityMl ?? body.capacity_ml ?? 2000);
      const nominalVolumeLtr = Number(body.nominalVolumeLtr ?? body.nominal_volume_ltr ?? (capacityMl / 1000));
      const tareWeightKg = body.tareWeightKg !== undefined ? Number(body.tareWeightKg) : (body.tare_weight_kg !== undefined ? Number(body.tare_weight_kg) : 0.08);
      const material = body.material || 'Food Grade Polypropylene';
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
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr", "status",
          "linked_raw_materials" AS "linkedRawMaterials", "created_at" AS "createdAt"
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
      await ensureBulkTable();
      const { id } = req.params;
      const b = req.body;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

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
          "nominal_volume_ltr"::FLOAT AS "nominalVolumeLtr", "status",
          "linked_raw_materials" AS "linkedRawMaterials", "updated_at" AS "updatedAt"
      `;

      const linkedJson = b.linkedRawMaterials !== undefined ? JSON.stringify(b.linkedRawMaterials) : null;

      const result = await prisma.$queryRawUnsafe(
        updateSql,
        id,
        b.unitName || b.unit_name || null,
        b.unitType || b.unit_type || null,
        b.capacityMl !== undefined ? Number(b.capacityMl) : null,
        b.nominalVolumeLtr !== undefined ? Number(b.nominalVolumeLtr) : null,
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
      await ensureBulkTable();
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
      await ensureBulkTable();
      const { id } = req.params;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

      await prisma.$queryRawUnsafe(`
        DELETE FROM "bulk_storage_units" 
        WHERE ${isUuid ? `"id" = $1::uuid` : `"unit_code" = $1`}
      `, id);

      res.json({ message: 'Bulk storage unit deleted successfully.', deleted: true });
    } catch (err) {
      console.error('Failed to delete bulk unit:', err);
      next(err);
    }
  }
}

module.exports = new BulkStorageUnitController();
