const bcrypt = require('bcrypt');
const userRepository = require('./user.repository');
const notificationService = require('../notifications/notifications.service');

class UserService {
  async getAllUsers() {
    return userRepository.findAll();
  }

  async createUser(userData) {
    const { name, email, password, role, ipAddress } = userData;
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw { status: 400, message: 'Email already exists.' };
    const passwordHash = await bcrypt.hash(password, 10);
    return userRepository.create({ name, email, passwordHash, role, ipAddress: ipAddress || null });
  }

  async updateUser(id, updateData) {
    const { password, ...restData } = updateData;
    if (password) restData.passwordHash = await bcrypt.hash(password, 10);
    if (restData.ipAddress === '') restData.ipAddress = null;
    return userRepository.update(id, restData);
  }

  async deactivateUser(id) {
    return userRepository.delete(id);
  }

  async getProfile(id) {
    const user = await userRepository.findById(id);
    if (!user) throw { status: 404, message: 'User not found.' };
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(id, data) {
    const { profilePhoto, name, email } = data;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
    return userRepository.updateProfile(id, updateData);
  }

  async requestPasswordChange({ userId, userName, userRole, newPassword, message }) {
    if (!newPassword) throw { status: 400, message: 'New password is required.' };

    await notificationService.createNotification({
      type: 'PASSWORD_CHANGE_REQUEST',
      recipient_roles: ['MAIN_MASTER'],
      sender_role: userRole,
      sender_id: userId,
      reference_type: 'USER',
      reference_id: userId,
      event_at: new Date(),
      message: `🔑 Password Change Request — ${userName} (${userRole.replace(/_/g, ' ')}) has requested a password change.\nMessage: "${message || 'No message provided'}"\nRequested password: "${newPassword}"\n→ Please update in User Management.`,
      metadata: { userId, userName, userRole, requestedPassword: newPassword, userMessage: message }
    });

    return { success: true, message: 'Password change request sent to the master admin.' };
  }
}

module.exports = new UserService();
