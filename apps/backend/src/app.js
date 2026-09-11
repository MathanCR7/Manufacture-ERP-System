const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

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
app.use(helmet());

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

// Load domain routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
