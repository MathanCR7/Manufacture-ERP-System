const prisma = require('../../database/prisma');

// Helper to format date into DDMMYY
function getDDMMYY(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

let tableEnsured = false;
async function ensureMouldTable() {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "production_moulds" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "mould_code" VARCHAR(50) UNIQUE NOT NULL,
        "mould_name" VARCHAR(150) NOT NULL,
        "mould_category" VARCHAR(50) NOT NULL DEFAULT '2000 Series',
        "model_number" VARCHAR(50),
        "capacity_ml" NUMERIC(12, 2) NOT NULL DEFAULT 50,
        "cavity_count" INT NOT NULL DEFAULT 42,
        "total_nominal_capacity_ml" NUMERIC(12, 2),
        "tray_length_mm" NUMERIC(10, 2),
        "tray_width_mm" NUMERIC(10, 2),
        "tray_height_mm" NUMERIC(10, 2),
        "cavity_length_mm" NUMERIC(10, 2),
        "cavity_width_mm" NUMERIC(10, 2),
        "cavity_depth_mm" NUMERIC(10, 2),
        "dimension_text" VARCHAR(100),
        "material" VARCHAR(100) DEFAULT 'SS 304 Food Grade',
        "machine_type" VARCHAR(100) DEFAULT 'Brine Tank Line 1',
        "specification_status" VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
        "supplier_id" UUID,
        "supplier_name" VARCHAR(150) DEFAULT 'Satnam Group',
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "total_sets_in_plant" INT DEFAULT 10,
        "notes" TEXT,
        "linked_raw_materials" JSONB DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "total_sets_in_plant" INT DEFAULT 10;
      ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "notes" TEXT;
      ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;
    `);

    // Check count and seed default moulds if empty
    const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::INT AS count FROM "production_moulds"`).catch(() => [{ count: 0 }]);
    const count = countRes?.[0]?.count || 0;
    if (count === 0) {
      await seedDefaultMoulds();
    }

    tableEnsured = true;
  } catch (err) {
    console.error('[MouldMasterController] ensureMouldTable error:', err?.message || err);
  }
}

async function seedDefaultMoulds() {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        OR: [
          { code: { in: ['RM-00119', 'RM-00120', 'RM-00155', 'RM-00156'] } },
          { name: { contains: 'STICK', mode: 'insensitive' } },
          { name: { contains: 'ROLL', mode: 'insensitive' } }
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

    const rmStick65 = getRm('RM-00119', 'STICK 65 MM (Wooden Stick)');
    const rmStick144 = getRm('RM-00120', 'STICK 144 MM (Wooden Stick)');
    const rmRoll130 = getRm('RM-00155', 'PACKING ROLL 130MM');
    const rmRoll170 = getRm('RM-00156', 'PACKING ROLL 170MM');

    const defaultMoulds = [
      {
        mould_code: 'SG-2006',
        mould_name: 'Egypt Small (SG 2006)',
        mould_category: '2000 Series',
        model_number: 'SG-2006',
        capacity_ml: 18,
        cavity_count: 42,
        total_nominal_capacity_ml: 756,
        tray_length_mm: 325,
        tray_width_mm: 245,
        tray_height_mm: 160,
        dimension_text: '5N Mould / Delivery 210 NOS',
        material: 'SS 304 Food Grade',
        machine_type: 'Brine Tank Line 1',
        specification_status: 'VERIFIED',
        supplier_name: 'Satnam Group',
        status: 'ACTIVE',
        total_sets_in_plant: 10,
        linked_raw_materials: [
          { ...rmStick65, quantityPerUnit: 1, role: 'Wooden Stick' },
          { ...rmRoll130, quantityPerUnit: 0.001, role: 'Wrapper' }
        ]
      },
      {
        mould_code: 'SG-3006',
        mould_name: 'Flat Stick (SG 3006)',
        mould_category: '3000 Series',
        model_number: 'SG-3006',
        capacity_ml: 40,
        cavity_count: 50,
        total_nominal_capacity_ml: 2000,
        tray_length_mm: 325,
        tray_width_mm: 260,
        tray_height_mm: 160,
        dimension_text: '10N Mould / Delivery 500 NOS',
        material: 'SS 304 Food Grade',
        machine_type: 'Brine Tank Line 1',
        specification_status: 'VERIFIED',
        supplier_name: 'Satnam Group',
        status: 'ACTIVE',
        total_sets_in_plant: 10,
        linked_raw_materials: [
          { ...rmStick144, quantityPerUnit: 1, role: 'Wooden Stick' },
          { ...rmRoll170, quantityPerUnit: 0.001, role: 'Wrapper' }
        ]
      },
      {
        mould_code: 'SG-8112',
        mould_name: 'Kulfi Small (SG 8112)',
        mould_category: '8000 Series',
        model_number: 'SG-8112',
        capacity_ml: 50,
        cavity_count: 42,
        total_nominal_capacity_ml: 2100,
        tray_length_mm: 325,
        tray_width_mm: 245,
        tray_height_mm: 160,
        dimension_text: '20N Mould / Delivery 840 NOS',
        material: 'SS 304 Food Grade',
        machine_type: 'Brine Tank Line 1',
        specification_status: 'VERIFIED',
        supplier_name: 'Satnam Group',
        status: 'ACTIVE',
        total_sets_in_plant: 10,
        linked_raw_materials: [
          { ...rmStick144, quantityPerUnit: 1, role: 'Wooden Stick' },
          { ...rmRoll170, quantityPerUnit: 0.001, role: 'Wrapper' }
        ]
      },
      {
        mould_code: 'SG-8115',
        mould_name: 'Kulfi Large (SG 8115)',
        mould_category: '8000 Series',
        model_number: 'SG-8115',
        capacity_ml: 70,
        cavity_count: 42,
        total_nominal_capacity_ml: 2940,
        tray_length_mm: 325,
        tray_width_mm: 245,
        tray_height_mm: 160,
        dimension_text: '10N Mould / Delivery 420 NOS',
        material: 'SS 304 Food Grade',
        machine_type: 'Brine Tank Line 1',
        specification_status: 'VERIFIED',
        supplier_name: 'Satnam Group',
        status: 'ACTIVE',
        total_sets_in_plant: 10,
        linked_raw_materials: [
          { ...rmStick144, quantityPerUnit: 1, role: 'Wooden Stick' },
          { ...rmRoll170, quantityPerUnit: 0.001, role: 'Wrapper' }
        ]
      }
    ];

    for (const m of defaultMoulds) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "production_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "tray_length_mm", "tray_width_mm", "tray_height_mm",
          "dimension_text", "material", "machine_type",
          "specification_status", "supplier_name", "status", "total_sets_in_plant", "linked_raw_materials"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
        )
        ON CONFLICT ("mould_code") DO NOTHING;
      `, m.mould_code, m.mould_name, m.mould_category, m.model_number,
         m.capacity_ml, m.cavity_count,
         m.tray_length_mm, m.tray_width_mm, m.tray_height_mm,
         m.dimension_text, m.material, m.machine_type,
         m.specification_status, m.supplier_name, m.status, m.total_sets_in_plant,
         JSON.stringify(m.linked_raw_materials));
    }
  } catch (err) {
    console.error('[MouldMasterController] seedDefaultMoulds error:', err?.message || err);
  }
}

class MouldMasterController {
  // GET /api/item-setup/mould-master/next-code
  async getNextCode(req, res, next) {
    try {
      await ensureMouldTable();
      const dateStr = getDDMMYY();
      const prefix = `MLD${dateStr}-`;

      let result = [];
      try {
        result = await prisma.$queryRawUnsafe(`
          SELECT "mould_code" 
          FROM "production_moulds" 
          WHERE "mould_code" LIKE $1
          ORDER BY "mould_code" DESC
          LIMIT 1
        `, `${prefix}%`);
      } catch (err) {
        tableEnsured = false;
        await ensureMouldTable();
        result = await prisma.$queryRawUnsafe(`
          SELECT "mould_code" FROM "production_moulds" WHERE "mould_code" LIKE $1 ORDER BY "mould_code" DESC LIMIT 1
        `, `${prefix}%`).catch(() => []);
      }

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
      // Fallback response instead of 500
      const dateStr = getDDMMYY();
      res.json({ nextCode: `MLD${dateStr}-0001` });
    }
  }

  // GET /api/item-setup/mould-master
  async getAll(req, res, next) {
    try {
      await ensureMouldTable();
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
          COALESCE("total_sets_in_plant", 10) AS "totalSetsInPlant",
          "notes",
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

      let rows = [];
      try {
        rows = await prisma.$queryRawUnsafe(sql, ...params);
      } catch (queryErr) {
        console.warn('[MouldMasterController] query failed, retrying after table ensure:', queryErr?.message);
        tableEnsured = false;
        await ensureMouldTable();
        rows = await prisma.$queryRawUnsafe(sql, ...params).catch(() => []);
      }

      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Failed to get moulds:', err);
      // Safe fallback array instead of crashing with 500
      res.json([]);
    }
  }

  // GET /api/item-setup/mould-master/:id
  async getById(req, res, next) {
    try {
      await ensureMouldTable();
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
          COALESCE("total_sets_in_plant", 10) AS "totalSetsInPlant",
          "notes",
          COALESCE("linked_raw_materials", '[]'::jsonb) AS "linkedRawMaterials",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "production_moulds"
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        LIMIT 1
      `;

      let rows = await prisma.$queryRawUnsafe(sql, id).catch(() => []);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Mould master not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Failed to get mould by id:', err);
      res.status(404).json({ error: 'Mould not found' });
    }
  }

  // POST /api/item-setup/mould-master
  async create(req, res, next) {
    try {
      await ensureMouldTable();
      const body = req.body;

      // Auto generate code if not passed
      let code = (body.mouldCode || body.mould_code || '').trim();
      if (!code) {
        const dateStr = getDDMMYY();
        const prefix = `MLD${dateStr}-`;
        const result = await prisma.$queryRawUnsafe(`
          SELECT "mould_code" FROM "production_moulds" WHERE "mould_code" LIKE $1 ORDER BY "mould_code" DESC LIMIT 1
        `, `${prefix}%`).catch(() => []);
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
      ).catch(() => []);
      if (Array.isArray(dup) && dup.length > 0) {
        return res.status(400).json({ error: `Mould with code '${code}' already exists.` });
      }

      const name = (body.mouldName || body.mould_name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Mould name is required.' });
      }

      const category = body.mouldCategory || body.mould_category || '2000 Series';
      const modelNumber = body.modelNumber || body.model_number || null;
      const capacityMl = Number(body.capacityMl ?? body.capacity_ml ?? 50);
      const cavityCount = parseInt(body.cavityCount ?? body.cavity_count ?? 42, 10);
      const totalNominal = body.totalNominalCapacityMl ? Number(body.totalNominalCapacityMl) : (capacityMl * cavityCount);
      const trayLengthMm = body.trayLengthMm ? Number(body.trayLengthMm) : null;
      const trayWidthMm = body.trayWidthMm ? Number(body.trayWidthMm) : null;
      const trayHeightMm = body.trayHeightMm ? Number(body.trayHeightMm) : null;
      const cavityLengthMm = body.cavityLengthMm ? Number(body.cavityLengthMm) : null;
      const cavityWidthMm = body.cavityWidthMm ? Number(body.cavityWidthMm) : null;
      const cavityDepthMm = body.cavityDepthMm ? Number(body.cavityDepthMm) : null;
      const dimensionText = body.dimensionText || body.dimension_text || null;
      const material = body.material || 'SS 304 Food Grade';
      const machineType = body.machineType || body.machine_type || 'Brine Tank Line 1';
      const specificationStatus = body.specificationStatus || body.specification_status || 'VERIFIED';
      const supplierName = body.supplierName || body.supplier_name || 'Satnam Group';
      const status = body.status || 'ACTIVE';
      const totalSetsInPlant = parseInt(body.totalSetsInPlant ?? body.total_sets_in_plant ?? 10, 10);
      const notes = body.notes || null;
      const linkedRawMaterials = JSON.stringify(body.linkedRawMaterials || body.linked_raw_materials || []);

      const insertSql = `
        INSERT INTO "production_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "tray_length_mm", "tray_width_mm", "tray_height_mm",
          "cavity_length_mm", "cavity_width_mm", "cavity_depth_mm",
          "dimension_text", "material", "machine_type",
          "specification_status", "supplier_name", "status", "total_sets_in_plant", "notes", "linked_raw_materials"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
        )
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "status", "total_sets_in_plant" AS "totalSetsInPlant", "notes",
          "linked_raw_materials" AS "linkedRawMaterials", "created_at" AS "createdAt"
      `;

      const result = await prisma.$queryRawUnsafe(
        insertSql,
        code, name, category, modelNumber,
        capacityMl, cavityCount,
        trayLengthMm, trayWidthMm, trayHeightMm,
        cavityLengthMm, cavityWidthMm, cavityDepthMm,
        dimensionText, material, machineType,
        specificationStatus, supplierName, status, totalSetsInPlant, notes, linkedRawMaterials
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
      await ensureMouldTable();
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
          "total_sets_in_plant" = COALESCE($19, "total_sets_in_plant"),
          "notes" = COALESCE($20, "notes"),
          "linked_raw_materials" = COALESCE($21::jsonb, "linked_raw_materials"),
          "updated_at" = CURRENT_TIMESTAMP
        WHERE ${isUuid ? `"id" = $1::uuid` : `"mould_code" = $1`}
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
          "status", "total_sets_in_plant" AS "totalSetsInPlant", "notes",
          "linked_raw_materials" AS "linkedRawMaterials", "updated_at" AS "updatedAt"
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
        b.totalSetsInPlant !== undefined ? parseInt(b.totalSetsInPlant, 10) : null,
        b.notes !== undefined ? b.notes : null,
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
      await ensureMouldTable();
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
      await ensureMouldTable();
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
