const prisma = require('../../database/prisma');

const AUTH_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  empId: true,
  profilePhoto: true,
  isActive: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true
};

class AuthRepository {
  async findUserByEmail(email) {
    if (!email) return null;
    return prisma.user.findUnique({
      where: { email },
      select: AUTH_USER_SELECT
    });
  }
}

module.exports = new AuthRepository();
