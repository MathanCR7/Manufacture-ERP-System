const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Global Middlewares
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

// Context Middleware (Must be before routes)
const contextMiddleware = require('./middlewares/context.middleware');
app.use(contextMiddleware);

// Load domain routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
