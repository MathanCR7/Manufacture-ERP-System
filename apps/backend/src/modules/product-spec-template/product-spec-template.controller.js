const { z } = require('zod');
const repo = require('./product-spec-template.repository');

const fieldSchema = z.object({
  id: z.string().optional(),
  fieldName: z.string().min(1, 'Field name is required'),
  fieldKey: z.string().optional(),
  fieldType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'DATE', 'RANGE']).default('TEXT'),
  section: z.string().default('General Specs'),
  unitOfMeasure: z.string().optional().nullable(),
  isMandatory: z.boolean().default(false),
  defaultValue: z.any().optional().nullable(),
  options: z.array(z.string()).optional().nullable(),
  minValue: z.any().optional().nullable(),
  maxValue: z.any().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  displayOrder: z.number().optional().default(0)
});

const saveTemplateSchema = z.object({
  subcategoryId: z.string().uuid(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional().nullable(),
  fields: z.array(fieldSchema).default([])
});

const duplicateSchema = z.object({
  sourceSubcategoryId: z.string().uuid(),
  targetSubcategoryId: z.string().uuid(),
  overrideName: z.string().optional().nullable()
});

class ProductSpecTemplateController {
  async getBySubcategoryId(req, res, next) {
    try {
      const { subcategoryId } = req.params;
      const template = await repo.getBySubcategoryId(subcategoryId);
      if (!template) {
        return res.status(200).json({
          subcategoryId,
          name: 'Default Specification Template',
          description: '',
          version: 0,
          isActive: false,
          fields: []
        });
      }
      res.json(template);
    } catch (err) {
      next(err);
    }
  }

  async saveTemplate(req, res, next) {
    try {
      const validated = saveTemplateSchema.parse(req.body);
      const result = await repo.saveTemplate(validated.subcategoryId, validated);
      res.status(200).json(result);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation failed', errors: err.errors });
      }
      next(err);
    }
  }

  async duplicate(req, res, next) {
    try {
      const validated = duplicateSchema.parse(req.body);
      if (validated.sourceSubcategoryId === validated.targetSubcategoryId) {
        return res.status(400).json({ message: 'Source and target subcategories must be different' });
      }

      const result = await repo.duplicateTemplate(validated);
      res.status(200).json({
        message: 'Specification template duplicated successfully',
        template: result
      });
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation failed', errors: err.errors });
      }
      next(err);
    }
  }

  async exportExcel(req, res, next) {
    try {
      const { subcategoryId } = req.params;
      const buffer = await repo.generateExcelTemplate(subcategoryId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Material_Master_Template_${subcategoryId.slice(0, 8)}.xlsx`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductSpecTemplateController();
