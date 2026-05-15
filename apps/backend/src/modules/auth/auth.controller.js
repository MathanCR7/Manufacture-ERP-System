const authService = require('./auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json({ message: 'Login successful', ...result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      res.json({ message: 'Logout successful.' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
