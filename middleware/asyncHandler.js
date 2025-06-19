// backend/middleware/asyncHandler.js

// This middleware wraps asynchronous route handlers to catch any errors
// and pass them to the Express error handling middleware.
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
