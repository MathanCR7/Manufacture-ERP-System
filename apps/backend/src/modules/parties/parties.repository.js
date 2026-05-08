const prisma = require('../../database/prisma');
class PartiesRepository {
  async createCustomer(data) {
    return prisma.customer.create({ data });
  }

  async getAllCustomers() {
    return prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } }
      }
    });
  }

  async getCustomerById(id) {
    return prisma.customer.findUnique({
      where: { id },
      include: { user: { select: { name: true } } }
    });
  }

  async updateCustomer(id, data) {
    return prisma.customer.update({
      where: { id },
      data
    });
  }

  async deleteCustomer(id) {
    return prisma.customer.delete({ where: { id } });
  }

  async createSupplier(data) {
    return prisma.supplier.create({ data });
  }

  async getAllSuppliers() {
    return prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } }
      }
    });
  }

  async getSupplierById(id) {
    return prisma.supplier.findUnique({
      where: { id },
      include: { user: { select: { name: true } } }
    });
  }

  async updateSupplier(id, data) {
    return prisma.supplier.update({
      where: { id },
      data
    });
  }

  async deleteSupplier(id) {
    return prisma.supplier.delete({ where: { id } });
  }
}

module.exports = new PartiesRepository();
