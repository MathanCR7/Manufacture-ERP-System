const { requestContext } = require('../lib/context');

const contextMiddleware = (req, res, next) => {
  // We run the AsyncLocalStorage context. Anything inside `next()` will have access to `req` via requestContext.getStore()
  requestContext.run({ req }, () => {
    next();
  });
};

module.exports = contextMiddleware;
