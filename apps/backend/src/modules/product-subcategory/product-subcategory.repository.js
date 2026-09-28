const prisma = require('../../database/prisma');

class ProductSubcategoryRepository {
  async getAll({ categoryId } = {}) {
    const where = {};
    if (categoryId) where.categoryId = categoryId;

    return prisma.productSubcategory.findMany({
      where,
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, code: true } },
        defaultUom: { select: { id: true, name: true, abbreviation: true } },
        specTemplate: {
          select: {
            id: true,
            name: true,
            version: true,
            isActive: true,
            _count: { select: { fields: true } }
          }
        },
        _count: { select: { products: true } }
      }
    });
  }

  async getById(id) {
    return prisma.productSubcategory.findUnique({
      where: { id },
      include: {
        category: true,
        defaultUom: true,
        specTemplate: {
          include: {
            fields: {
              orderBy: { displayOrder: 'asc' }
            }
          }
        },
        _count: { select: { products: true } }
      }
    });
  }

  async findByCode(categoryId, code) {
    return prisma.productSubcategory.findFirst({
      where: {
        categoryId,
        code: { equals: code.trim(), mode: 'insensitive' }
      }
    });
  }

  async create(data) {
    const {
      categoryId,
      name,
      code,
      description,
      status = 'ACTIVE',
      skuPrefix,
      hsnCodeDefault,
      defaultUomId
    } = data;

    const nameUpper = name.trim().toUpperCase();
    const normalizedCode = code ? code.trim().toUpperCase() : nameUpper.slice(0, 3).toUpperCase();
    const prefix = skuPrefix ? skuPrefix.trim().toUpperCase() : normalizedCode;

    return prisma.productSubcategory.create({
      data: {
        categoryId,
        name: nameUpper,
        code: normalizedCode,
        description: description ? description.trim() : null,
        status,
        skuPrefix: prefix,
        hsnCodeDefault: hsnCodeDefault ? hsnCodeDefault.trim() : null,
        defaultUomId: defaultUomId || null
      },
      include: {
        category: true,
        defaultUom: true
      }
    });
  }

  async update(id, data) {
    const {
      categoryId,
      name,
      code,
      description,
      status,
      skuPrefix,
      hsnCodeDefault,
      defaultUomId
    } = data;

    const updatePayload = {};
    if (categoryId !== undefined) updatePayload.categoryId = categoryId;
    if (name !== undefined) updatePayload.name = name.trim().toUpperCase();
    if (code !== undefined) updatePayload.code = code.trim().toUpperCase();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (status !== undefined) updatePayload.status = status;
    if (skuPrefix !== undefined) updatePayload.skuPrefix = skuPrefix ? skuPrefix.trim().toUpperCase() : null;
    if (hsnCodeDefault !== undefined) updatePayload.hsnCodeDefault = hsnCodeDefault ? hsnCodeDefault.trim() : null;
    if (defaultUomId !== undefined) updatePayload.defaultUomId = defaultUomId || null;

    return prisma.productSubcategory.update({
      where: { id },
      data: updatePayload,
      include: {
        category: true,
        defaultUom: true,
        specTemplate: true
      }
    });
  }

  async delete(id) {
    return prisma.productSubcategory.delete({
      where: { id }
    });
  }
}

module.exports = new ProductSubcategoryRepository();
