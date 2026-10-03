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

  async lookupCustomers(query = '') {
    const q = query ? query.trim() : '';
    if (!q) {
      return prisma.customer.findMany({
        take: 25,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
          email: true,
          gstin: true,
          customerType: true,
          creditLimit: true,
          openingBalance: true,
          balanceType: true,
          defaultDiscount: true,
          address: true
        }
      });
    }

    return prisma.customer.findMany({
      take: 25,
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { contactPerson: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { gstin: { contains: q, mode: 'insensitive' } },
        ]
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        email: true,
        gstin: true,
        customerType: true,
        creditLimit: true,
        openingBalance: true,
        balanceType: true,
        defaultDiscount: true,
        address: true
      }
    });
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

  async lookupSuppliers(query = '') {
    const q = query ? query.trim() : '';
    if (!q) {
      return prisma.supplier.findMany({
        take: 25,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
          email: true,
          gstin: true,
          creditLimit: true,
          openingBalance: true,
          balanceType: true,
          address: true
        }
      });
    }

    return prisma.supplier.findMany({
      take: 25,
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { contactPerson: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { gstin: { contains: q, mode: 'insensitive' } },
        ]
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        email: true,
        gstin: true,
        creditLimit: true,
        openingBalance: true,
        balanceType: true,
        address: true
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
