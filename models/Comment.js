// backend/models/Comment.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  content: {
    type: String,
    required: [true, 'Comment content cannot be empty'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
  },
  // Reference to the Issue this comment belongs to
  issue: {
    type: Schema.Types.ObjectId,
    ref: 'Issue', // Links to the Issue model
    required: true,
  },
  // Reference to the User who authored this comment
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Links to the User model
    required: true,
  },
  // Automated timestamps for creation and last update
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  // timestamps: true, // Uncomment if you prefer Mongoose to manage timestamps automatically
});

// Middleware to update 'updatedAt' field on every save
commentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
