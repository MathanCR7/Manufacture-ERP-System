const authService = require('./auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
      const result = await authService.login(email, password, ip);
      res.json({ message: 'Login successful', ...result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const userId = req.user?.id;
      if (userId) {
        const prisma = require('../../database/prisma');
        const now = new Date();
        const lastSession = await prisma.userSessionLog.findFirst({
          where: { userId, logoutAt: null },
          orderBy: { loginAt: 'desc' }
        });
        if (lastSession) {
          const durationSeconds = Math.round((now - new Date(lastSession.loginAt)) / 1000);
          await prisma.userSessionLog.update({
            where: { id: lastSession.id },
            data: { logoutAt: now, durationSeconds }
          });
        }
      }
      res.json({ message: 'Logout successful.' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
