const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const authRepository = require('./auth.repository');

class AuthService {
  async login(email, password, ip) {
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required.' };
    }

    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive) {
      throw { status: 401, message: 'Invalid email or password.' };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password.' };
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const prisma = require('../../database/prisma');
    await prisma.userSessionLog.create({
      data: {
        userId: user.id,
        loginAt: new Date(),
        ip: ip || '127.0.0.1'
      }
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto || null,
        empId: user.empId || null
      }
    };
  }
}

module.exports = new AuthService();
