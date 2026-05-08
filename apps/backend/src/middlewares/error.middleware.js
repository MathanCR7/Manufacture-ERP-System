const logger = require('../utilities/logger');

const errorHandler = (err, req, res, next) => {
  // Directly log the raw error object so we don't miss anything (like undefined properties)
  console.error('\n[RAW ERROR CAUGHT BY MIDDLEWARE]:', err);

  res.status(err?.status || 500).json({
    error: err?.name || 'InternalServerError',
    message: err?.message || 'Something went wrong on the server',
    code: err?.code || 'INTERNAL_ERROR'
  });
};

module.exports = errorHandler;
