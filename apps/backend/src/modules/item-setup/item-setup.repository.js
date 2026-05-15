const prisma = require('../../database/prisma');
class ItemSetupRepository {
  // RM Category
  async createRMCategory(data) { return prisma.rMCategory.create({ data }); }
  async getRMCategories() { return prisma.rMCategory.findMany({ orderBy: { createdAt: 'desc' } }); }
  async getRMCategoryById(id) { return prisma.rMCategory.findUnique({ where: { id } }); }
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
  async updateRawMaterial(id, data) { return prisma.rawMaterial.update({ where: { id }, data }); }
  async deleteRawMaterial(id) { return prisma.rawMaterial.delete({ where: { id } }); }

  // Non Inventory Item
  async createNonInventoryItem(data) { return prisma.nonInventoryItem.create({ data }); }
  async getNonInventoryItems() { return prisma.nonInventoryItem.findMany({ orderBy: { createdAt: 'desc' } }); }
  async getNonInventoryItemById(id) { return prisma.nonInventoryItem.findUnique({ where: { id } }); }
  async updateNonInventoryItem(id, data) { return prisma.nonInventoryItem.update({ where: { id }, data }); }
  async deleteNonInventoryItem(id) { return prisma.nonInventoryItem.delete({ where: { id } }); }

  // Product Category
  async createProductCategory(data) { return prisma.productCategory.create({ data }); }
  async getProductCategories() { return prisma.productCategory.findMany({ orderBy: { createdAt: 'desc' } }); }
  async getProductCategoryById(id) { return prisma.productCategory.findUnique({ where: { id } }); }
  async updateProductCategory(id, data) { return prisma.productCategory.update({ where: { id }, data }); }
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
