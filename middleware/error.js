// backend/middleware/error.js

/**
 * Global Error Handling Middleware
 *
 * This middleware catches errors that occur in your Express routes
 * and sends a standardized error response to the client.
 * It's designed to be used as the last `app.use()` middleware in your `server.js`.
 *
 * @param {Error} err - The error object.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function (not used in terminal error handler, but good practice to include).
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for server-side debugging
  console.error(err.stack); // Full stack trace

  // Default error message and status code
  let statusCode = 500;
  let message = 'Server Error';

  // Handle specific Mongoose errors or custom errors
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = `Resource not found with id of ${err.value}`;
  }

  if (err.code === 11000) { // Mongoose duplicate key error (e.g., unique field violated)
    statusCode = 400;
    message = 'Duplicate field value entered';
  }

  if (err.name === 'ValidationError') { // Mongoose validation error
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  if (err.name === 'JsonWebTokenError') { // JWT error for invalid token
    statusCode = 401;
    message = 'Not authorized: Invalid token';
  }

  if (err.name === 'TokenExpiredError') { // JWT error for expired token
    statusCode = 401;
    message = 'Not authorized: Token has expired';
  }

  // Send the error response
  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

module.exports = errorHandler;
