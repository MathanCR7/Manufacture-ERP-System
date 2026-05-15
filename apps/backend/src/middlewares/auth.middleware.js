const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../database/prisma');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    
    // Perform IP Lock Check
    const { id, role } = decoded;

    // MAIN_MASTER and SUPERVISOR bypass IP Lock entirely
    if (role !== 'MAIN_MASTER' && role !== 'SUPERVISOR') {
      const dbUser = await prisma.user.findUnique({
        where: { id },
        select: { ipAddress: true, isActive: true }
      });

      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ error: 'User is deactivated or does not exist.' });
      }

      // If an IP lock is defined in the database
      if (dbUser.ipAddress && dbUser.ipAddress.trim() !== '') {
        const requestIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        
        // Clean up IP string (IPv6 loopback ::1, IPv4-mapped IPv6 ::ffff:127.0.0.1, etc.)
        const normalizedReqIp = requestIp.replace(/^.*:/, ''); 
        const normalizedDbIp = dbUser.ipAddress.replace(/^.*:/, '');

        if (normalizedReqIp !== normalizedDbIp && requestIp !== dbUser.ipAddress) {
          return res.status(403).json({ 
            error: 'Access denied: Unauthorized IP Address.',
            details: process.env.NODE_ENV === 'development' ? `Expected ${dbUser.ipAddress}, got ${requestIp}` : undefined
          });
        }
      }
    }

    next();
  } catch (ex) {
    if (ex.name === 'JsonWebTokenError' || ex.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    console.error('Auth Middleware Error:', ex);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;
