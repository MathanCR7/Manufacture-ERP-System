const AuditLogRepository = require('./audit.repository');

class AuditLogController {
  async getAll(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await AuditLogRepository.getAuditLogs(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditLogController();
