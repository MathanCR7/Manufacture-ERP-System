const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log("Checking DATABASE_URL:", process.env.DATABASE_URL ? "FOUND" : "NOT FOUND");
console.log("Checking JWT_SECRET:", process.env.JWT_SECRET ? "FOUND" : "NOT FOUND");

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET, // <--- Add this line
};