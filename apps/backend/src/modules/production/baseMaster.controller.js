const { z } = require('zod');
const prisma = require('../../database/prisma');

const baseSchema = z.object({
  code: z.string().trim().min(2).max(20).transform(v => v.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE')
});

class BaseMasterController {
  async getAll(req, res, next) {
    try {
      const { status } = req.query;
      const where = status && status !== 'ALL' ? { status } : {};

      const bases = await prisma.baseMaster.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { templates: true }
          }
        }
      });

      const formatted = bases.map(b => ({
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        status: b.status,
        templateCount: b._count.templates,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const base = await prisma.baseMaster.findUnique({
        where: { id: req.params.id },
        include: {
          templates: {
            include: { lines: true }
          }
        }
      });
      if (!base) return res.status(404).json({ error: 'Base master not found' });
      res.json(base);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const data = baseSchema.parse(req.body);

      const existingCode = await prisma.baseMaster.findFirst({
        where: {
          OR: [
            { code: data.code },
            { name: { equals: data.name, mode: 'insensitive' } }
          ]
        }
      });

      if (existingCode) {
        return res.status(400).json({ error: 'A Base with this code or name already exists' });
      }

      const created = await prisma.baseMaster.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description || null,
          status: data.status
        }
      });

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = baseSchema.partial().parse(req.body);

      const base = await prisma.baseMaster.findUnique({ where: { id } });
      if (!base) return res.status(404).json({ error: 'Base master not found' });

      if (data.code || data.name) {
        const conflict = await prisma.baseMaster.findFirst({
          where: {
            id: { not: id },
            OR: [
              ...(data.code ? [{ code: data.code }] : []),
              ...(data.name ? [{ name: { equals: data.name, mode: 'insensitive' } }] : [])
            ]
          }
        });
        if (conflict) {
          return res.status(400).json({ error: 'Another Base with this code or name already exists' });
        }
      }

      const updated = await prisma.baseMaster.update({
        where: { id },
        data: {
          ...(data.code && { code: data.code }),
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.status && { status: data.status })
        }
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const templateCount = await prisma.productionTemplate.count({
        where: { baseId: id }
      });

      if (templateCount > 0) {
        return res.status(400).json({
          error: `Cannot delete Base "${id}" because it is linked to ${templateCount} production template(s). Deactivate it instead.`
        });
      }

      await prisma.baseMaster.delete({ where: { id } });
      res.json({ message: 'Base deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BaseMasterController();
