const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// ─────────────────────── RM LAB CATEGORY ───────────────────────

const RM_LAB_CATEGORIES = [
  {
    name: 'Dairy RM',
    code: 'DAIRY_RM',
    labTests: ['Fat %', 'SNF', 'Acidity', 'Protein', 'MBRT', 'TPC', 'Coliform'],
    acceptableResults: 'Fat as per spec, SNF >8.5%, Low acidity, Coliform absent',
    rmExamples: 'Milk, Cream, SMP, Butter, Whey Powder',
  },
  {
    name: 'Milk Powder',
    code: 'MILK_POWDER',
    labTests: ['Moisture', 'Solubility', 'Protein', 'Microbial Test'],
    acceptableResults: 'Moisture low (<5%), Good solubility, No contamination',
    rmExamples: 'Skim Milk Powder (SMP), Whole Milk Powder',
  },
  {
    name: 'Fat RM',
    code: 'FAT_RM',
    labTests: ['Fat %', 'FFA', 'Peroxide Value'],
    acceptableResults: 'High purity fat, No rancidity',
    rmExamples: 'Butter Oil, Cream Fat',
  },
  {
    name: 'Nut RM',
    code: 'NUT_RM',
    labTests: ['Moisture', 'Aflatoxin', 'Mold', 'Odor'],
    acceptableResults: 'Aflatoxin absent, Low moisture, Fresh smell',
    rmExamples: 'Cashew, Almond, Pistachio, Peanut',
  },
  {
    name: 'Sweetener RM',
    code: 'SWEETENER_RM',
    labTests: ['Purity', 'Moisture', 'Brix', 'Color'],
    acceptableResults: 'High purity, Clear color',
    rmExamples: 'Sugar, Glucose Syrup, Corn Syrup',
  },
  {
    name: 'Cocoa & Chocolate RM',
    code: 'COCOA_CHOCO_RM',
    labTests: ['Fat %', 'Moisture', 'Flavor', 'Microbial'],
    acceptableResults: 'Rich cocoa flavor, Low moisture',
    rmExamples: 'Cocoa Powder, Chocolate Paste',
  },
  {
    name: 'Fruit RM',
    code: 'FRUIT_RM',
    labTests: ['pH', 'Brix', 'Microbial', 'Preservatives'],
    acceptableResults: 'Correct sweetness, Low bacteria',
    rmExamples: 'Mango Pulp, Strawberry Pulp, Banana Puree',
  },
  {
    name: 'Stabilizer RM',
    code: 'STABILIZER_RM',
    labTests: ['Viscosity', 'Moisture', 'Solubility'],
    acceptableResults: 'Stable viscosity, Good hydration',
    rmExamples: 'Guar Gum, CMC, Carrageenan',
  },
  {
    name: 'Emulsifier RM',
    code: 'EMULSIFIER_RM',
    labTests: ['Emulsification Test', 'Purity'],
    acceptableResults: 'Stable emulsion',
    rmExamples: 'Mono Diglycerides',
  },
  {
    name: 'Flavor RM',
    code: 'FLAVOR_RM',
    labTests: ['Aroma', 'Stability', 'pH'],
    acceptableResults: 'Strong stable flavor',
    rmExamples: 'Vanilla, Butterscotch, Chocolate Flavor',
  },
  {
    name: 'Color RM',
    code: 'COLOR_RM',
    labTests: ['Shade Check', 'Stability'],
    acceptableResults: 'Uniform color',
    rmExamples: 'Natural/Permitted Food Colors',
  },
  {
    name: 'Water RM',
    code: 'WATER_RM',
    labTests: ['pH', 'TDS', 'Hardness', 'TPC', 'E.coli'],
    acceptableResults: 'E.coli absent, Safe potable quality',
    rmExamples: 'RO Water, Process Water',
  },
  {
    name: 'Packaging RM',
    code: 'PACKAGING_RM',
    labTests: ['Migration Test', 'Cleanliness'],
    acceptableResults: 'Food-grade safe',
    rmExamples: 'Cups, Lids, Wrappers',
  },
  {
    name: 'Add-on RM',
    code: 'ADDON_RM',
    labTests: ['Moisture', 'Texture', 'Microbial'],
    acceptableResults: 'Crispy, contamination-free',
    rmExamples: 'Choco Chips, Cookies, Candy Pieces',
  },
];

const categorySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  labTests: z.array(z.string()).min(1),
  acceptableResults: z.string().min(1),
  rmExamples: z.string().optional(),
  description: z.string().optional(),
});

// GET /api/rm-lab-category — List all RM Lab Categories
router.get('/',
  authenticateToken,
  async (req, res, next) => {
    try {
      let categories = await prisma.rMLabCategory.findMany({
        orderBy: { name: 'asc' },
        include: { requiredResults: { orderBy: { paramName: 'asc' } } },
      });
      res.json(categories);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/rm-lab-category/defaults — Get the predefined defaults
router.get('/defaults',
  authenticateToken,
  async (req, res) => {
    res.json(RM_LAB_CATEGORIES);
  }
);

// GET /api/rm-lab-category/:id — Get a single category
router.get('/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const cat = await prisma.rMLabCategory.findUnique({
        where: { id: req.params.id },
        include: { requiredResults: { orderBy: { paramName: 'asc' } } },
      });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
      res.json(cat);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/rm-lab-category — Create a new RM Lab Category
router.post('/',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = categorySchema.parse(req.body);
      const category = await prisma.rMLabCategory.create({
        data: {
          name: data.name,
          code: data.code,
          labTests: data.labTests,
          acceptableResults: data.acceptableResults,
          rmExamples: data.rmExamples || null,
          description: data.description || null,
        },
      });
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// PATCH /api/rm-lab-category/:id — Update a category
router.patch('/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = categorySchema.partial().parse(req.body);
      const updated = await prisma.rMLabCategory.update({
        where: { id: req.params.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.code && { code: data.code }),
          ...(data.labTests && { labTests: data.labTests }),
          ...(data.acceptableResults && { acceptableResults: data.acceptableResults }),
          ...(data.rmExamples !== undefined && { rmExamples: data.rmExamples }),
          ...(data.description !== undefined && { description: data.description }),
        },
        include: { requiredResults: true },
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// POST /api/rm-lab-category/seed-defaults — Seed the default categories
router.post('/seed-defaults',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER']),
  async (req, res, next) => {
    try {
      const results = [];
      for (const cat of RM_LAB_CATEGORIES) {
        const existing = await prisma.rMLabCategory.findFirst({ where: { code: cat.code } });
        if (!existing) {
          const created = await prisma.rMLabCategory.create({
            data: {
              name: cat.name,
              code: cat.code,
              labTests: cat.labTests,
              acceptableResults: cat.acceptableResults,
              rmExamples: cat.rmExamples,
            },
          });
          results.push({ action: 'created', name: cat.name, id: created.id });
        } else {
          results.push({ action: 'exists', name: cat.name, id: existing.id });
        }
      }
      res.json({ message: 'Seed complete', results });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── RM LAB REQUIRED RESULTS ───────────────────────

const requiredResultSchema = z.object({
  categoryId: z.string().uuid(),
  paramName: z.string().min(1),
  paramUnit: z.string().optional(),
  acceptableMin: z.coerce.number().optional(),
  acceptableMax: z.coerce.number().optional(),
  acceptableText: z.string().optional(),
  isRequired: z.boolean().default(true),
  testMethod: z.string().optional(),
});

// GET /api/rm-lab-category/required-results/:categoryId — Get required results for a category
router.get('/required-results/:categoryId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const results = await prisma.rMLabRequiredResult.findMany({
        where: { categoryId: req.params.categoryId },
        orderBy: { paramName: 'asc' },
      });
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/rm-lab-category/required-results — Add a required result param
router.post('/required-results',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = requiredResultSchema.parse(req.body);
      const result = await prisma.rMLabRequiredResult.create({
        data: {
          categoryId: data.categoryId,
          paramName: data.paramName,
          paramUnit: data.paramUnit || null,
          acceptableMin: data.acceptableMin ?? null,
          acceptableMax: data.acceptableMax ?? null,
          acceptableText: data.acceptableText || null,
          isRequired: data.isRequired,
          testMethod: data.testMethod || null,
        },
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// POST /api/rm-lab-category/required-results/bulk — Bulk upsert required results
router.post('/required-results/bulk',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const { categoryId, params } = z.object({
        categoryId: z.string().uuid(),
        params: z.array(z.object({
          paramName: z.string().min(1),
          paramUnit: z.string().optional(),
          acceptableMin: z.coerce.number().optional(),
          acceptableMax: z.coerce.number().optional(),
          acceptableText: z.string().optional(),
          isRequired: z.boolean().default(true),
          testMethod: z.string().optional(),
        })),
      }).parse(req.body);

      // Delete existing, then create new
      await prisma.rMLabRequiredResult.deleteMany({ where: { categoryId } });
      const created = await prisma.rMLabRequiredResult.createMany({
        data: params.map(p => ({
          categoryId,
          paramName: p.paramName,
          paramUnit: p.paramUnit || null,
          acceptableMin: p.acceptableMin ?? null,
          acceptableMax: p.acceptableMax ?? null,
          acceptableText: p.acceptableText || null,
          isRequired: p.isRequired ?? true,
          testMethod: p.testMethod || null,
        })),
      });
      res.json({ count: created.count });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// PATCH /api/rm-lab-category/required-results/:id — Update a required result
router.patch('/required-results/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = requiredResultSchema.partial().parse(req.body);
      const updated = await prisma.rMLabRequiredResult.update({
        where: { id: req.params.id },
        data: {
          ...(data.paramName && { paramName: data.paramName }),
          ...(data.paramUnit !== undefined && { paramUnit: data.paramUnit }),
          ...(data.acceptableMin !== undefined && { acceptableMin: data.acceptableMin }),
          ...(data.acceptableMax !== undefined && { acceptableMax: data.acceptableMax }),
          ...(data.acceptableText !== undefined && { acceptableText: data.acceptableText }),
          ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
          ...(data.testMethod !== undefined && { testMethod: data.testMethod }),
        },
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// DELETE /api/rm-lab-category/required-results/:id — Delete a required result
router.delete('/required-results/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      await prisma.rMLabRequiredResult.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
