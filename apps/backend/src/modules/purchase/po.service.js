const poRepository = require('./po.repository');

class POService {
  async getAllPOs() {
    return poRepository.findAll();
  }

  async getPOById(id) {
    return poRepository.findById(id);
  }

  async createPO(data, userId) {
    const poData = {
      ...data,
      createdBy: userId,
      status: 'PENDING'
    };
    return poRepository.create(poData);
  }
}

module.exports = new POService();
