// backend/models/Project.js

const mongoose = require('mongoose');

// Define the schema for a Project
const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'], // Name is mandatory
    trim: true, // Remove whitespace from both ends of a string
    minlength: [3, 'Project name must be at least 3 characters long'],
    maxlength: [100, 'Project name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Project description cannot exceed 500 characters'],
  },
  // 'status' could be 'Active', 'Completed', 'On Hold', etc.
  status: {
    type: String,
    enum: ['Active', 'Completed', 'On Hold', 'Archived'], // Predefined list of allowed statuses
    default: 'Active', // Default status for new projects
  },
  // 'priority' could be 'Low', 'Medium', 'High', 'Critical'
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'], // Predefined list of allowed priorities
    default: 'Medium', // Default priority for new projects
  },
  // Reference to the User who created the project (if applicable)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Refers to the 'User' model
    required: true, // A project must have a creator
  },
  // An array of objects, where each object represents a project member
  members: [ // <--- ADDED: This is the new members array
    {
      user: { // Reference to the User model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: { // Role within the project (e.g., 'developer', 'qa', 'manager')
        type: String,
        enum: ['developer', 'qa', 'manager'], // Example roles
        default: 'developer',
      },
    },
  ],
  // Removed 'assignedUsers' as 'members' with roles now handles team association.
  // assignedUsers: [
  //   {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'User',
  //   },
  // ],
  // Dates for creation and last update
  createdAt: {
    type: Date,
    default: Date.now, // Sets the creation date automatically
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  // Mongoose automatically adds 'createdAt' and 'updatedAt' fields
  // if timestamps are set to true. We've defined them manually for more control
  // but if you remove them from schema, you can enable timestamps here.
  // timestamps: true,
});

// Update 'updatedAt' field on every save
projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Project model from the schema
const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
