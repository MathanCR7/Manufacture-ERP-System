const userService = require('./user.service');

class UserController {
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) { next(error); }
  }

  async createUser(req, res, next) {
    try {
      const newUser = await userService.createUser(req.body);
      res.status(201).json(newUser);
    } catch (error) { next(error); }
  }

  async updateUser(req, res, next) {
    try {
      const updatedUser = await userService.updateUser(req.params.id, req.body);
      res.json(updatedUser);
    } catch (error) { next(error); }
  }

  async deactivateUser(req, res, next) {
    try {
      const result = await userService.deactivateUser(req.params.id);
      res.json(result);
    } catch (error) { next(error); }
  }

  async getProfile(req, res, next) {
    try {
      const user = await userService.getProfile(req.user.id);
      res.json(user);
    } catch (error) { next(error); }
  }

  async updateProfile(req, res, next) {
    try {
      const { name, email, profilePhoto } = req.body;
      const updated = await userService.updateProfile(req.user.id, { name, email, profilePhoto });
      res.json(updated);
    } catch (error) { next(error); }
  }

  async requestPasswordChange(req, res, next) {
    try {
      const { newPassword, message } = req.body;
      const result = await userService.requestPasswordChange({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        newPassword,
        message
      });
      res.json(result);
    } catch (error) { next(error); }
  }
}

module.exports = new UserController();
