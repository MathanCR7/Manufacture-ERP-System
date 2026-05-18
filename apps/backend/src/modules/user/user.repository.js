const prisma = require('../../database/prisma');

class UserRepository {
  async findAll() {
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, ipAddress: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(data) {
    return prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true, ipAddress: true, isActive: true, createdAt: true }
    });
  }

  async update(id, data) {
    return prisma.user.update({
      where: { id }, data,
      select: { id: true, name: true, email: true, role: true, ipAddress: true, isActive: true, createdAt: true, updatedAt: true }
    });
  }

  async updateProfile(id, data) {
    return prisma.user.update({
      where: { id }, data,
      select: { id: true, name: true, email: true, role: true, profilePhoto: true, isActive: true, updatedAt: true }
    });
  }

  async delete(id) {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true }
    });
  }
}

module.exports = new UserRepository();
