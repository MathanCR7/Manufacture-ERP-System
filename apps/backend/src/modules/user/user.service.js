const bcrypt = require('bcrypt');
const userRepository = require('./user.repository');

class UserService {
  async getAllUsers() {
    return userRepository.findAll();
  }

  async createUser(userData) {
    const { name, email, password, role, ipAddress } = userData;
    
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw { status: 400, message: 'Email already exists.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await userRepository.create({
      name,
      email,
      passwordHash,
      role,
      ipAddress: ipAddress || null
    });

    return newUser;
  }

  async updateUser(id, updateData) {
    const { password, ...restData } = updateData;
    
    // If password is provided, hash it
    if (password) {
      restData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    // Clean empty ipAddress strings to null
    if (restData.ipAddress === '') {
      restData.ipAddress = null;
    }

    const updatedUser = await userRepository.update(id, restData);
    return updatedUser;
  }

  async deactivateUser(id) {
    return userRepository.delete(id);
  }
}

module.exports = new UserService();
