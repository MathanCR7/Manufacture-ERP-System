const logger = require('../utilities/logger');
const prisma = require('../database/prisma');

const errorHandler = async (err, req, res, next) => {
  // Directly log the raw error object so we don't miss anything (like undefined properties)
  console.error('\n[RAW ERROR CAUGHT BY MIDDLEWARE]:', err);

  const statusCode = Number(err?.status) || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;
  const errorMessage = err?.message || (isClientError ? 'Request failed' : 'Something went wrong on the server');

  try {
    if (statusCode >= 500) {
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
    }
  } catch (dbErr) {
    console.error('Failed to save error log in database:', dbErr.message);
  }

  let defaultName = 'InternalServerError';
  let defaultCode = 'INTERNAL_ERROR';

  if (statusCode === 400) {
    defaultName = 'BadRequest';
    defaultCode = 'BAD_REQUEST';
  } else if (statusCode === 401) {
    defaultName = 'Unauthorized';
    defaultCode = 'UNAUTHORIZED';
  } else if (statusCode === 403) {
    defaultName = 'Forbidden';
    defaultCode = 'FORBIDDEN';
  } else if (statusCode === 404) {
    defaultName = 'NotFound';
    defaultCode = 'NOT_FOUND';
  } else if (isClientError) {
    defaultName = 'ClientError';
    defaultCode = 'CLIENT_ERROR';
  }

  res.status(statusCode).json({
    error: isClientError ? errorMessage : (err?.name || defaultName),
    message: errorMessage,
    code: err?.code || defaultCode
  });
};

module.exports = errorHandler;
