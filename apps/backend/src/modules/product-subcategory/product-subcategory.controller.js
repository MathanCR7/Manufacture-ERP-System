const { z } = require('zod');
const repo = require('./product-subcategory.repository');
const prisma = require('../../database/prisma');

const subcategorySchema = z.object({
  categoryId: z.string().uuid({ message: 'Valid Main Category is required' }),
  name: z.string().min(1, { message: 'Subcategory name is required' }).max(100),
  code: z.string().min(1, { message: 'Code is required' }).max(20),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  skuPrefix: z.string().max(20).optional().nullable(),
  hsnCodeDefault: z.string().max(20).optional().nullable(),
  defaultUomId: z.string().optional().nullable()
});

class ProductSubcategoryController {
  async getAll(req, res, next) {
    try {
      const { categoryId } = req.query;
      const subcategories = await repo.getAll({ categoryId });
      res.json(subcategories);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const subcategory = await repo.getById(req.params.id);
      if (!subcategory) {
        return res.status(404).json({ message: 'Product subcategory not found' });
      }
      res.json(subcategory);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const validated = subcategorySchema.parse(req.body);

      // Check for code uniqueness within the same category
      const existing = await repo.findByCode(validated.categoryId, validated.code);
      if (existing) {
        return res.status(409).json({
          message: `Subcategory with code '${validated.code.toUpperCase()}' already exists in this category`
        });
      }

      const created = await repo.create(validated);
      res.status(201).json(created);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation failed', errors: err.errors });
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const validated = subcategorySchema.partial().parse(req.body);

      const existing = await repo.getById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Product subcategory not found' });
      }

      // Check code conflict if code is changing
      if (validated.code && validated.code.toUpperCase() !== existing.code.toUpperCase()) {
        const catId = validated.categoryId || existing.categoryId;
        const codeConflict = await repo.findByCode(catId, validated.code);
        if (codeConflict && codeConflict.id !== id) {
          return res.status(409).json({
            message: `Subcategory with code '${validated.code.toUpperCase()}' already exists in this category`
          });
        }
      }

      const updated = await repo.update(id, validated);
      res.json(updated);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation failed', errors: err.errors });
      }
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const subcategory = await repo.getById(id);
      if (!subcategory) {
        return res.status(404).json({ message: 'Product subcategory not found' });
      }

      // Prevent deletion if products exist
      const linkedProducts = await prisma.finishedProduct.findMany({
        where: { subcategoryId: id },
        select: { id: true, code: true, name: true, sku: true }
      });

      if (linkedProducts.length > 0) {
        const prodSummary = linkedProducts.map(p => `${p.code || p.sku || 'PROD'} - ${p.name}`).join(', ');
        return res.status(409).json({
          error: 'SUBCATEGORY_IN_USE',
          message: `Cannot delete subcategory "${subcategory.name}" (${subcategory.code}) because ${linkedProducts.length} product(s) are assigned to it: ${prodSummary}. Please reassign or delete these products first.`,
          products: linkedProducts
        });
      }

      await repo.delete(id);

      // Audit Log Record
      try {
        let userId = req.user?.id;
        if (!userId) {
          const firstUser = await prisma.user.findFirst({ select: { id: true } });
          userId = firstUser ? firstUser.id : null;
        }
        if (userId) {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'DELETE_PRODUCT_SUBCATEGORY',
              tableName: 'product_subcategories',
              recordId: id,
              oldValue: subcategory,
              newValue: null,
              ip: req.ip || req.connection?.remoteAddress || '127.0.0.1'
            }
          });
        }
      } catch (auditErr) {
        console.error('[AuditLog Error]', auditErr.message);
      }

      res.status(200).json({ message: 'Subcategory deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductSubcategoryController();
