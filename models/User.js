// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For generating authentication tokens <--- ADDED THIS IMPORT

const UserSchema = new mongoose.Schema({
  username: { // <-- CHANGED from 'name' to 'username' for consistency
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    trim: true, // Trim whitespace
    maxlength: [50, 'Username can not be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [ // <-- ADDED email regex validation
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'], // <-- ADDED minlength validation
    select: false // Ensures password is not returned in queries by default <--- ADDED this crucial security setting
  },
  role: {
    type: String,
    enum: ['user', 'admin'], // <-- Simplified roles for initial setup, consistent with backend logic
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to hash password before saving the user
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) { // Only hash if password field is new or modified
    next();
  }
  const salt = await bcrypt.genSalt(10); // Generate a salt
  this.password = await bcrypt.hash(this.password, salt); // Hash the password
  next();
});

// Method to generate and return a JWT token <--- ADDED THIS METHOD (CRITICAL)
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE // Token expiration time from environment variables
  });
};

// Method to compare entered password with hashed password in DB
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
