require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_key',
  DATABASE_URL: process.env.DATABASE_URL
};
