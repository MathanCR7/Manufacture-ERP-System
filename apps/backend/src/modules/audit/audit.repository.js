const prisma = require('../../database/prisma');

class AuditLogRepository {
  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, role: true }
          }
        }
      }),
      prisma.auditLog.count()
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new AuditLogRepository();
