const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Global Middlewares
app.use(morgan('dev'));
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
