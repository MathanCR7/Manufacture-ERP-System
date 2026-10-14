const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

const path = require('path');
const app = express();

// Trust proxy header when running behind Nginx reverse proxy
app.set('trust proxy', 1);

// Global Middlewares
app.use(morgan('dev'));
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept && req.headers.accept === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
  frameguard: false
}));

const configuredOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) 
  : ['http://localhost:5173', 'http://localhost:3000', 'https://erp.leonex.net', 'http://erp.leonex.net'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, mobile apps, or same-origin reverse-proxied requests without an Origin header
    if (!origin) return callback(null, true);
    if (configuredOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.leonex.net') || origin === 'https://leonex.net') return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Context Middleware (Must be before routes)
const contextMiddleware = require('./middlewares/context.middleware');
app.use(contextMiddleware);

// Root / Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Manufacturing ERP API is running',
    version: '1.0.0'
  });
});

// Static file serving for uploads (receipts, proof images, documents) with invoice fallback
app.use(['/uploads', '/api/uploads'], (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '../uploads');
    const reqPath = decodeURIComponent(req.path || '').split('?')[0];

    // 1. Check direct path on disk
    const directPath = path.join(uploadsDir, reqPath);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return res.sendFile(directPath);
    }

    const filename = path.basename(reqPath);
    if (!filename) return next();

    // 2. Extract clean PO reference number (e.g. PO-000019)
    const poMatch = filename.match(/(PO-\d+)/i) || reqPath.match(/(PO-\d+)/i) || filename.match(/(PO-[A-Za-z0-9]+)/i);
    const poRef = poMatch ? poMatch[1].toUpperCase() : null;

    // 3. Search in dedicated PO invoice subfolders (e.g. /invoices/PO-000019/...)
    if (poRef) {
      const pInvoicesPo = path.join(uploadsDir, 'invoices', poRef, filename);
      if (fs.existsSync(pInvoicesPo) && fs.statSync(pInvoicesPo).isFile()) {
        return res.sendFile(pInvoicesPo);
      }
      const pInvoicesPoLower = path.join(uploadsDir, 'invoices', poRef.toLowerCase(), filename);
      if (fs.existsSync(pInvoicesPoLower) && fs.statSync(pInvoicesPoLower).isFile()) {
        return res.sendFile(pInvoicesPoLower);
      }
    }

    // 4. Search in payments/ folder
    const pPayments = path.join(uploadsDir, 'payments', filename);
    if (fs.existsSync(pPayments) && fs.statSync(pPayments).isFile()) {
      return res.sendFile(pPayments);
    }

    // 5. Search in invoices/ root
    const pInvoices = path.join(uploadsDir, 'invoices', filename);
    if (fs.existsSync(pInvoices) && fs.statSync(pInvoices).isFile()) {
      return res.sendFile(pInvoices);
    }

    // 6. Search in root uploads/
    const pRoot = path.join(uploadsDir, filename);
    if (fs.existsSync(pRoot) && fs.statSync(pRoot).isFile()) {
      return res.sendFile(pRoot);
    }

    // 7. Dynamic scan across all subdirectories of invoices/
    const invoicesBase = path.join(uploadsDir, 'invoices');
    if (fs.existsSync(invoicesBase)) {
      const subdirs = fs.readdirSync(invoicesBase, { withFileTypes: true });
      for (const dirent of subdirs) {
        if (dirent.isDirectory()) {
          const candidate = path.join(invoicesBase, dirent.name, filename);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return res.sendFile(candidate);
          }
        }
      }
    }
  } catch (_) {}

  next();
}, express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
  }
}));

// Load domain routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
