const prisma = require('../../database/prisma');

class PORepository {
  async findAll() {
    return prisma.purchaseOrder.findMany({
      include: { rawMaterial: true }
    });
  }

  async findById(id) {
    return prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: { rawMaterial: true }
    });
  }

  async create(data) {
    return prisma.purchaseOrder.create({
      data
    });
  }
}

module.exports = new PORepository();
