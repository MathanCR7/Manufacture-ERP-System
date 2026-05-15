const prisma = require('../../database/prisma');

class PORepository {
  async findAll() {
    return prisma.rawMaterialPO.findMany({
      include: { idRegistry: true, uom: true, user: true }
    });
  }

  async findById(id) {
    return prisma.rawMaterialPO.findUnique({
      where: { id },
      include: { idRegistry: true, uom: true, user: true }
    });
  }

  async create(data) {
    return prisma.rawMaterialPO.create({
      data,
      include: { uom: true, user: true }
    });
  }
}

module.exports = new PORepository();
