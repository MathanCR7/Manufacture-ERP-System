const prisma = require('../../database/prisma');

class AuthRepository {
  async findUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email }
    });
  }
}

module.exports = new AuthRepository();
