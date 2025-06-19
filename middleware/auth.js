    // backend/middleware/auth.js

    const jwt = require('jsonwebtoken');
    const asyncHandler = require('./asyncHandler'); // Import the asyncHandler middleware
    const User = require('../models/User'); // Import the User model

    /**
     * @function protect
     * @description Middleware to protect routes, ensuring only authenticated users can access them.
     * It checks for a JWT token in the Authorization header (Bearer) or in cookies.
     * If a valid token is found, it decodes it and attaches the corresponding user object to `req.user`.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    exports.protect = asyncHandler(async (req, res, next) => {
      let token;

      // 1. Check for token in headers (Authorization: Bearer <token>)
      // This is typically how tokens are sent from frontend JS (e.g., Axios interceptors).
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      // 2. Check for token in cookies
      // This is essential if you're using HTTP-only cookies for security.
      else if (req.cookies.token) {
        token = req.cookies.token;
      }

      // If no token is found, or it's an empty/invalid string, deny access immediately.
      if (!token || typeof token !== 'string' || token.trim() === '') {
        return res.status(401).json({ success: false, msg: 'Not authorized to access this route (no valid token provided or token is empty)' });
      }

      try {
        // Verify the token using the JWT_SECRET from environment variables.
        // jwt.verify will throw an error if the token is invalid or expired.
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user associated with the decoded token ID.
        // .select('-password') ensures the password hash is not returned with the user object.
        req.user = await User.findById(decoded.id).select('-password');

        // If no user is found for the given ID (e.g., user deleted after token issue),
        // then the token is effectively invalid.
        if (!req.user) {
            // Clear the potentially invalid token from cookies to prevent future issues.
            res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
            // In a real scenario, frontend should also clear its localStorage token.
            return res.status(401).json({ success: false, msg: 'Not authorized to access this route (user associated with token not found)' });
        }

        // If authentication is successful, proceed to the next middleware/route handler.
        next();
      } catch (err) {
        // Handle specific JWT errors for more informative responses.
        if (err.name === 'JsonWebTokenError') {
          console.error('JWT Error: Invalid token:', err.message);
          return res.status(401).json({ success: false, msg: `Not authorized: Invalid token (${err.message})` });
        } else if (err.name === 'TokenExpiredError') {
          console.error('JWT Error: Token expired:', err.message);
          // Clear expired token from cookies to prompt re-login.
          res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
          return res.status(401).json({ success: false, msg: 'Not authorized: Token has expired' });
        } else {
          // Catch any other unexpected errors during token verification.
          console.error('Token verification failed (other error):', err);
          return res.status(401).json({ success: false, msg: 'Not authorized: Token verification failed due to an unexpected error.' });
        }
      }
    });

    /**
     * @function authorize
     * @description Middleware to restrict access to specific roles.
     * This should be used after the `protect` middleware.
     * @param {...string} roles - A list of roles that are allowed to access the route (e.g., 'admin', 'manager').
     * @returns {Function} Express middleware function
     */
    exports.authorize = (...roles) => {
      return (req, res, next) => {
        // This middleware assumes req.user has already been populated by the `protect` middleware.
        if (!req.user || !roles.includes(req.user.role)) {
          // If the user's role is not in the allowed roles array, deny access.
          return res.status(403).json({ success: false, msg: `User role ${req.user?.role || 'none'} is not authorized to access this route` });
        }
        // If authorized, proceed to the next middleware/route handler.
        next();
      };
    };
    