const prisma = require('../../database/prisma');
class ItemSetupRepository {
  // RM Category
  async createRMCategory(data) { return prisma.rMCategory.create({ data }); }
  async getRMCategories() { return prisma.rMCategory.findMany({ orderBy: { createdAt: 'desc' }, include: { rawMaterials: true } }); }
  async getRMCategoryById(id) { return prisma.rMCategory.findUnique({ where: { id }, include: { rawMaterials: true } }); }
  async updateRMCategory(id, data) { return prisma.rMCategory.update({ where: { id }, data }); }
  async deleteRMCategory(id) { return prisma.rMCategory.delete({ where: { id } }); }

  // Raw Material
  async createRawMaterial(data) { return prisma.rawMaterial.create({ data }); }
  async getRawMaterials() { 
    return prisma.rawMaterial.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { category: true, uoms: true }
    }); 
  }
  async getRawMaterialById(id) { return prisma.rawMaterial.findUnique({ where: { id }, include: { category: true, uoms: true } }); }
  async updateRawMaterial(id, data) { 
    const { 
      category, 
      categoryId,
      uoms, 
      createdAt, 
      updatedAt, 
      id: _, 
      stockAdjustments, 
      wasteItems, 
      productBOMs, 
      productionBatchRMUsages, 
      productionLossMaterials,
      baseTemplateItems,
      learnedRecipeItems,
      hasPurchases,
      purchaseOrders,
      ...updateData 
    } = data;

    if (categoryId) {
      updateData.category = { connect: { id: categoryId } };
    }

    return prisma.rawMaterial.update({ where: { id }, data: updateData }); 
  }
  async deleteRawMaterial(id) { return prisma.rawMaterial.delete({ where: { id } }); }

  // Non Inventory Item
  async createNonInventoryItem(data) {
    const { 
      name, 
      code, 
      category, 
      unitId, 
      ratePerUnit,
      hsnCode,
      description,
      consumptionUnit,
      hasAlternateUom,
      alternateUom,
      baseUomQty,
      alternateUomQty,
      conversionFactor
    } = data;
    return prisma.nonInventoryItem.create({
      data: { 
        name, 
        code, 
        category, 
        unitId, 
        ratePerUnit,
        hsnCode,
        description,
        consumptionUnit,
        hasAlternateUom: Boolean(hasAlternateUom),
        alternateUom: alternateUom || null,
        baseUomQty: baseUomQty || 1.0,
        alternateUomQty: alternateUomQty || 1.0,
        conversionFactor: conversionFactor || 1.0
      }
    });
  }
  async getNonInventoryItems() { return prisma.nonInventoryItem.findMany({ orderBy: { createdAt: 'desc' } }); }
  async getNonInventoryItemById(id) { return prisma.nonInventoryItem.findUnique({ where: { id } }); }
  async updateNonInventoryItem(id, data) {
    const { 
      name, 
      code, 
      category, 
      unitId, 
      ratePerUnit,
      hsnCode,
      description,
      consumptionUnit,
      hasAlternateUom,
      alternateUom,
      baseUomQty,
      alternateUomQty,
      conversionFactor
    } = data;
    return prisma.nonInventoryItem.update({
      where: { id },
      data: { 
        name, 
        code, 
        category, 
        unitId, 
        ratePerUnit,
        hsnCode,
        description,
        consumptionUnit,
        hasAlternateUom: Boolean(hasAlternateUom),
        alternateUom: alternateUom || null,
        baseUomQty: baseUomQty || 1.0,
        alternateUomQty: alternateUomQty || 1.0,
        conversionFactor: conversionFactor || 1.0
      }
    });
  }
  async deleteNonInventoryItem(id) { return prisma.nonInventoryItem.delete({ where: { id } }); }

  // Product Category
  async createProductCategory(data) {
    const formattedData = {
      ...data,
      name: data.name ? data.name.trim().toUpperCase() : data.name,
      code: data.code ? data.code.trim().toUpperCase() : undefined
    };
    return prisma.productCategory.create({ data: formattedData });
  }
  async getProductCategories() { 
    return prisma.productCategory.findMany({ 
      orderBy: { createdAt: 'desc' }, 
      include: { 
        subcategories: true,
        finishedProducts: { select: { id: true, code: true, name: true, sku: true } },
        products: { select: { id: true, code: true, name: true } }
      } 
    }); 
  }
  async getProductCategoryById(id) { 
    return prisma.productCategory.findUnique({ 
      where: { id }, 
      include: { 
        subcategories: true,
        finishedProducts: { select: { id: true, code: true, name: true, sku: true } },
        products: { select: { id: true, code: true, name: true } }
      } 
    }); 
  }
  async updateProductCategory(id, data) {
    const formattedData = {
      ...data,
      name: data.name ? data.name.trim().toUpperCase() : data.name,
      code: data.code ? data.code.trim().toUpperCase() : undefined
    };
    return prisma.productCategory.update({ where: { id }, data: formattedData });
  }
  async deleteProductCategory(id) { return prisma.productCategory.delete({ where: { id } }); }

  // Product
  async createProduct(data) { return prisma.product.create({ data }); }
  async getProducts() { 
    return prisma.product.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { category: true }
    }); 
  }
  async getProductById(id) { return prisma.product.findUnique({ where: { id } }); }
  async updateProduct(id, data) { return prisma.product.update({ where: { id }, data }); }
  async deleteProduct(id) { return prisma.product.delete({ where: { id } }); }
}

module.exports = new ItemSetupRepository();
