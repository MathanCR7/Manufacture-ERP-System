const { PrismaClient } = require('@prisma/client');
const { requestContext } = require('../../lib/context');

const prisma = new PrismaClient();

const excludedTables = ['AuditLog', 'UserSessionLog', 'Notification'];

const extendedPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (excludedTables.includes(model)) return query(args);

        const store = requestContext.getStore();
        const req = store?.req;
        const userId = req?.user?.id;
        const ip = req?.ip || '127.0.0.1';

        if (['create', 'update', 'delete'].includes(operation) && userId) {
          let oldValue = null;
          
          if (operation === 'update' || operation === 'delete') {
            try {
              const camelModel = model.charAt(0).toLowerCase() + model.slice(1);
              oldValue = await this[camelModel].findUnique({ where: args.where });
            } catch (err) {
              console.error(`Error fetching old value for ${model}:`, err);
            }
          }

          const result = await query(args);

          try {
            await this.auditLog.create({
              data: {
                userId: userId,
                action: operation.toUpperCase(),
                tableName: model,
                recordId: result?.id || args.where?.id || 'UNKNOWN',
                oldValue: oldValue || {},
                newValue: operation === 'delete' ? null : (result || {}),
                ip: ip
              }
            });
          } catch(err) {
             console.error('AuditLog insertion failed:', err.message);
          }

          return result;
        }

        return query(args);
      }
    }
  }
});

module.exports = extendedPrisma;
