// backend/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For creating and verifying tokens
const asyncHandler = require('../middleware/asyncHandler'); // Custom async error handler
const User = require('../models/User'); // User model
const { protect } = require('../middleware/auth'); // Auth middleware

// Helper function to generate JWT token
const getSignedJwtToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @route POST /api/auth/register
// @desc Register user
// @access Public
router.post('/register', asyncHandler(async (req, res, next) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  // Check if user already exists
  let user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({ msg: 'User already exists with this email' });
  }

  // Create new user
  user = await User.create({
    username,
    email,
    password, // Password will be hashed by pre-save hook in User model
  });

  // Generate token and send response
  const token = getSignedJwtToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}));

// @route POST /api/auth/login
// @desc Login user
// @access Public
router.post('/login', asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password'); // Select password explicitly

  if (!user) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }

  // Generate token
  const token = getSignedJwtToken(user._id);

  // Set cookie options
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000), // Convert days to milliseconds
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'Lax', // Or 'Strict' or 'None' (with secure: true)
  };

  // Send response with token in cookie and body
  res.status(200)
    .cookie('token', token, options) // Set cookie
    .json({
      success: true,
      token, // Also send in body for frontend to use (e.g., localStorage fallback, Axios interceptor)
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
}));

// @route GET /api/auth/logout
// @desc Log user out / clear cookie
// @access Private
router.get('/logout', protect, asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });

  res.status(200).json({
    success: true,
    msg: 'Logged out successfully',
  });
}));

// @route GET /api/auth/me
// @desc Get current logged in user
// @access Private
router.get('/me', protect, asyncHandler(async (req, res, next) => {
  // req.user is populated from the protect middleware
  const user = await User.findById(req.user.id).select('-password'); // Exclude password

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}));

module.exports = router;
