// backend/models/Issue.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const issueSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Issue title is required'],
    trim: true,
    minlength: [5, 'Issue title must be at least 5 characters long'],
    maxlength: [200, 'Issue title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Issue description cannot exceed 2000 characters'],
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'], // Status workflow
    default: 'Open',
    required: true,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'], // Priority levels
    default: 'Medium',
    required: true,
  },
  type: {
    type: String,
    enum: ['Bug', 'Feature', 'Task', 'Improvement'], // Type of issue
    default: 'Bug',
    required: true,
  },
  // Reference to the Project this issue belongs to
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project', // Links to the Project model
    required: [true, 'Issue must belong to a project'],
  },
  // Reference to the User who created this issue
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Links to the User model
    required: true,
  },
  // Reference to the User who is currently assigned to resolve this issue (optional)
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Links to the User model
    default: null, // Can be unassigned
  },
  // Due date for the issue (optional)
  dueDate: {
    type: Date,
    default: null,
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
  // Mongoose will automatically manage createdAt and updatedAt if 'timestamps: true'
  // But we've added them manually for more control and pre-save hook.
  // If you enable this, ensure you remove 'createdAt' and 'updatedAt' from schema above.
  // timestamps: true,
});

// Middleware to update 'updatedAt' field on every save
issueSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// IMPORTANT: Change 'remove' to 'deleteOne' for Mongoose 5.x+
// This hook ensures that when an issue document is deleted using .deleteOne(),
// all associated comments are also deleted.
issueSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  // 'this' refers to the document being deleted
  console.log(`Deleting all comments for issue: ${this._id}`);
  try {
    await this.model('Comment').deleteMany({ issue: this._id });
    next();
  } catch (err) {
    console.error('Error deleting comments for issue:', err);
    next(err); // Pass error to the next middleware
  }
});


const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
