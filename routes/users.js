// backend/routes/users.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth'); // Import authentication middleware
const asyncHandler = require('../middleware/asyncHandler'); // Import asyncHandler

const User = require('../models/User'); // Import the User model

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (e.g., only authenticated users can see other users for assignments/members)
 * You might even restrict this further to 'admin' or 'project managers' in a real app.
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  // In a production app, consider pagination for a large number of users.
  // For now, fetch all users.
  const users = await User.find().select('-password'); // Exclude passwords from the response

  res.json(users);
}));

/**
 * @route GET /api/users/:id
 * @desc Get a single user by ID
 * @access Private (e.g., only authenticated users can view user profiles)
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  // Validate if the provided ID is a valid Mongoose ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid User ID format' });
  }

  const user = await User.findById(req.params.id).select('-password'); // Exclude password

  if (!user) {
    return res.status(404).json({ msg: 'User not found' });
  }

  res.json(user);
}));

// You can add more user-related routes here (e.g., update user, delete user by admin)

module.exports = router;
