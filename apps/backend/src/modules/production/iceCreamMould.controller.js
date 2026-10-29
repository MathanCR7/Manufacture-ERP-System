const prisma = require('../../database/prisma');
const { z } = require('zod');

class IceCreamMouldController {
  // GET /api/production/moulds
  async getMoulds(req, res, next) {
    try {
      const { category, specificationStatus, machineType, search, status } = req.query;

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

      if (machineType && machineType !== 'ALL') {
        whereClause += ` AND "machine_type" = $${paramIdx++}`;
        params.push(machineType);
      }

      if (status && status !== 'ALL') {
        whereClause += ` AND "status" = $${paramIdx++}`;
        params.push(status);
      } else {
        whereClause += ` AND "status" != 'INACTIVE'`;
      }

      if (search && search.trim()) {
        whereClause += ` AND ("mould_code" ILIKE $${paramIdx} OR "mould_name" ILIKE $${paramIdx} OR "model_number" ILIKE $${paramIdx} OR "supplier_name" ILIKE $${paramIdx})`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      let rows = [];
      try {
        const sql = `
          SELECT 
            "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName", 
            "mould_category" AS "mouldCategory", "model_number" AS "modelNumber",
            "capacity_ml"::FLOAT AS "capacityMl", "cavity_count" AS "cavityCount",
            "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
            "tray_length_mm"::FLOAT AS "lengthMm", "tray_width_mm"::FLOAT AS "widthMm", "tray_height_mm"::FLOAT AS "heightMm",
            "cavity_length_mm"::FLOAT AS "cavityLengthMm", "cavity_width_mm"::FLOAT AS "cavityWidthMm", "cavity_depth_mm"::FLOAT AS "cavityDepthMm",
            "material", "machine_type" AS "machineType", "dimension_source" AS "dimensionSource",
            "specification_status" AS "specificationStatus", "supplier_id" AS "supplierId", 
            "supplier_name" AS "supplierName", "status", "created_at" AS "createdAt"
          FROM ice_cream_mould
          ${whereClause}
          ORDER BY 
            CASE WHEN "specification_status" = 'VERIFIED' THEN 1 ELSE 2 END,
            "mould_category" ASC, 
            "capacity_ml" ASC, 
            "mould_code" ASC
        `;
        rows = await prisma.$queryRawUnsafe(sql, ...params);
      } catch (viewErr) {
        // Fallback to production_moulds
        const fallbackSql = `
          SELECT 
            "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName", 
            "mould_category" AS "mouldCategory", "model_number" AS "modelNumber",
            "capacity_ml"::FLOAT AS "capacityMl", "cavity_count" AS "cavityCount",
            "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl",
            "tray_length_mm"::FLOAT AS "lengthMm", "tray_width_mm"::FLOAT AS "widthMm", "tray_height_mm"::FLOAT AS "heightMm",
            "material", "machine_type" AS "machineType",
            "specification_status" AS "specificationStatus", "status", "created_at" AS "createdAt"
          FROM production_moulds
          ${whereClause}
          ORDER BY "mould_category" ASC, "capacity_ml" ASC, "mould_code" ASC
        `;
        rows = await prisma.$queryRawUnsafe(fallbackSql, ...params);
      }
      res.json(rows);
    } catch (err) {
      console.error('Failed to get ice cream moulds:', err);
      next(err);
    }
  }

  // GET /api/production/moulds/categories
  async getCategories(req, res, next) {
    try {
      let categories = [];
      try {
        const sql = `
          SELECT 
            "mould_category" AS "category",
            COUNT(*)::INT AS "count",
            SUM("total_nominal_capacity_ml")::FLOAT AS "totalNominalCapacityMl",
            SUM(CASE WHEN "specification_status" = 'VERIFIED' THEN 1 ELSE 0 END)::INT AS "verifiedCount"
          FROM ice_cream_mould
          WHERE "status" != 'INACTIVE'
          GROUP BY "mould_category"
          ORDER BY 
            CASE 
              WHEN "mould_category" = 'VERIFIED_SPECS' THEN 1
              WHEN "mould_category" = 'STICK' THEN 2
              WHEN "mould_category" = 'KULFI' THEN 3
              WHEN "mould_category" = 'NOVELTY' THEN 4
              WHEN "mould_category" = 'CUPS_CONES_TUBS' THEN 5
              WHEN "mould_category" = 'SANDWICH_CAKE_SPECIALTY' THEN 6
              ELSE 7
            END
        `;
        categories = await prisma.$queryRawUnsafe(sql);
      } catch (_) {
        const fallbackSql = `
          SELECT 
            "mould_category" AS "category",
            COUNT(*)::INT AS "count",
            SUM("total_nominal_capacity_ml")::FLOAT AS "totalNominalCapacityMl",
            SUM(CASE WHEN "specification_status" = 'VERIFIED' THEN 1 ELSE 0 END)::INT AS "verifiedCount"
          FROM production_moulds
          WHERE "status" != 'INACTIVE'
          GROUP BY "mould_category"
        `;
        categories = await prisma.$queryRawUnsafe(fallbackSql);
      }
      res.json(categories);
    } catch (err) {
      console.error('Failed to get mould categories:', err);
      next(err);
    }
  }

  // POST /api/production/moulds
  async createMould(req, res, next) {
    try {
      const schema = z.object({
        mouldCode: z.string().min(1, 'Mould code is required'),
        mouldName: z.string().min(1, 'Mould name is required'),
        mouldCategory: z.string().default('STICK'),
        modelNumber: z.string().optional().nullable(),
        capacityMl: z.coerce.number().positive('Capacity must be positive'),
        cavityCount: z.coerce.number().int().min(1).default(1),
        lengthMm: z.coerce.number().optional().nullable(),
        widthMm: z.coerce.number().optional().nullable(),
        heightMm: z.coerce.number().optional().nullable(),
        cavityLengthMm: z.coerce.number().optional().nullable(),
        cavityWidthMm: z.coerce.number().optional().nullable(),
        cavityDepthMm: z.coerce.number().optional().nullable(),
        material: z.string().default('Stainless Steel 304'),
        machineType: z.string().default('Brine Tank Line'),
        dimensionSource: z.string().default('Custom'),
        specificationStatus: z.enum(['VERIFIED', 'ESTIMATE', 'MACHINE_SPECIFIC', 'CUSTOM']).default('CUSTOM'),
        supplierId: z.string().optional().nullable(),
        supplierName: z.string().optional().nullable(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'PROVISIONAL']).default('ACTIVE')
      });

      const data = schema.parse(req.body);

      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "ice_cream_moulds" WHERE "mould_code" = $1 LIMIT 1`,
        data.mouldCode
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return res.status(400).json({ error: `Mould with code '${data.mouldCode}' already exists.` });
      }

      const insertSql = `
        INSERT INTO "ice_cream_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "length_mm", "width_mm", "height_mm",
          "cavity_length_mm", "cavity_width_mm", "cavity_depth_mm",
          "material", "machine_type", "dimension_source",
          "specification_status", "supplier_id", "supplier_name", "status"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl"
      `;

      const result = await prisma.$queryRawUnsafe(
        insertSql,
        data.mouldCode,
        data.mouldName,
        data.mouldCategory,
        data.modelNumber || null,
        data.capacityMl,
        data.cavityCount,
        data.lengthMm || null,
        data.widthMm || null,
        data.heightMm || null,
        data.cavityLengthMm || null,
        data.cavityWidthMm || null,
        data.cavityDepthMm || null,
        data.material,
        data.machineType,
        data.dimensionSource,
        data.specificationStatus,
        data.supplierId || null,
        data.supplierName || null,
        data.status
      );

      res.status(201).json(result[0]);
    } catch (err) {
      console.error('Failed to create mould:', err);
      next(err);
    }
  }

  // PUT /api/production/moulds/:id
  async updateMould(req, res, next) {
    try {
      const { id } = req.params;
      const b = req.body;

      const updateSql = `
        UPDATE "ice_cream_moulds" SET
          "mould_name" = COALESCE($2, "mould_name"),
          "mould_category" = COALESCE($3, "mould_category"),
          "model_number" = COALESCE($4, "model_number"),
          "capacity_ml" = COALESCE($5, "capacity_ml"),
          "cavity_count" = COALESCE($6, "cavity_count"),
          "length_mm" = COALESCE($7, "length_mm"),
          "width_mm" = COALESCE($8, "width_mm"),
          "height_mm" = COALESCE($9, "height_mm"),
          "cavity_length_mm" = COALESCE($10, "cavity_length_mm"),
          "cavity_width_mm" = COALESCE($11, "cavity_width_mm"),
          "cavity_depth_mm" = COALESCE($12, "cavity_depth_mm"),
          "material" = COALESCE($13, "material"),
          "machine_type" = COALESCE($14, "machine_type"),
          "dimension_source" = COALESCE($15, "dimension_source"),
          "specification_status" = COALESCE($16, "specification_status"),
          "supplier_name" = COALESCE($17, "supplier_name"),
          "status" = COALESCE($18, "status"),
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1::UUID
        RETURNING 
          "id", "mould_code" AS "mouldCode", "mould_name" AS "mouldName",
          "mould_category" AS "mouldCategory", "capacity_ml"::FLOAT AS "capacityMl",
          "cavity_count" AS "cavityCount", "total_nominal_capacity_ml"::FLOAT AS "totalNominalCapacityMl"
      `;

      const result = await prisma.$queryRawUnsafe(
        updateSql,
        id,
        b.mouldName,
        b.mouldCategory,
        b.modelNumber,
        b.capacityMl,
        b.cavityCount,
        b.lengthMm,
        b.widthMm,
        b.heightMm,
        b.cavityLengthMm,
        b.cavityWidthMm,
        b.cavityDepthMm,
        b.material,
        b.machineType,
        b.dimensionSource,
        b.specificationStatus,
        b.supplierName,
        b.status
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Mould not found' });
      }

      res.json(result[0]);
    } catch (err) {
      console.error('Failed to update mould:', err);
      next(err);
    }
  }
}

module.exports = new IceCreamMouldController();
