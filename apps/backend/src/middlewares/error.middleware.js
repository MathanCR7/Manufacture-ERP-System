const logger = require('../utilities/logger');
const prisma = require('../database/prisma');

const errorHandler = async (err, req, res, next) => {
  // Directly log the raw error object so we don't miss anything (like undefined properties)
  console.error('\n[RAW ERROR CAUGHT BY MIDDLEWARE]:', err);

  try {
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    await prisma.errorLog.create({
      data: {
        userId,
        userRole,
        message: err?.message || 'Unknown error occurred',
        stack: err?.stack || null,
        path: req.originalUrl || req.url || 'unknown',
        method: req.method || 'unknown',
        ip: String(ip)
      }
    });
  } catch (dbErr) {
    console.error('Failed to save error log in database:', dbErr.message);
  }

  res.status(err?.status || 500).json({
    error: err?.name || 'InternalServerError',
    message: err?.message || 'Something went wrong on the server',
    code: err?.code || 'INTERNAL_ERROR'
  });
};

module.exports = errorHandler;
