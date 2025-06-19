// backend/routes/issues.js

const express = require('express');
const router = express.Router();
// Correctly import protect and authorize from the middleware
const { protect, authorize } = require('../middleware/auth');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId for validation

// Import Mongoose models
const Issue = require('../models/Issue');
const Comment = require('../models/Comment');
const Project = require('../models/Project'); // Needed to validate project existence
const User = require('../models/User');     // Needed to validate user existence (assignedTo, createdBy)

// --- Helper function for error handling ---
// This function wraps asynchronous route handlers to catch any errors and pass them to the Express error middleware.
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- Issue Routes ---

/**
 * @route GET /api/issues
 * @desc Get all issues (with optional filters, sorting, and pagination)
 * @access Private (requires authentication)
 *
 * Query Parameters:
 * - project: Filter by project ID
 * - status: Filter by issue status (e.g., 'Open', 'Resolved')
 * - priority: Filter by issue priority (e.g., 'High', 'Medium')
 * - type: Filter by issue type (e.g., 'Bug', 'Feature')
 * - assignedTo: Filter by assigned user ID
 * - search: Search by keywords in title or description
 * - sortBy: Field to sort by (e.g., 'createdAt', 'priority')
 * - order: Sort order ('asc' for ascending, 'desc' for descending)
 * - page: Current page number (for pagination, default 1)
 * - limit: Number of issues per page (for pagination, default 10)
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  const { project, status, priority, type, assignedTo, search, sortBy, order, page = 1, limit = 10 } = req.query;
  const query = {}; // Initialize an empty query object

  // Add filters to the query based on provided parameters
  if (project) {
    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).json({ msg: 'Invalid Project ID format' });
    }
    query.project = project;
  }
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (type) query.type = type;
  if (assignedTo) {
    // Validate assignedTo user ID format
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({ msg: 'Invalid Assigned User ID format' });
    }
    const userExists = await User.findById(assignedTo);
    if (!userExists) {
        return res.status(404).json({ msg: 'Assigned user for filter not found' });
    }
    query.assignedTo = assignedTo;
  }
  if (search) {
    // Implement case-insensitive search across title and description fields
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Define sorting options
  const sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = order === 'desc' ? -1 : 1; // -1 for descending, 1 for ascending
  } else {
    sortOptions.createdAt = -1; // Default sort by creation date (newest first)
  }

  // Calculate skip for pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Find issues matching the query, sort, paginate, and populate related fields
  const issues = await Issue.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('project', 'name')             // Populate 'name' field from Project model
    .populate('createdBy', 'username email') // Populate 'username' and 'email' from User model
    .populate('assignedTo', 'username email'); // Populate 'username' and 'email' from User model

  // Get the total count of issues matching the filter for pagination metadata
  const totalIssues = await Issue.countDocuments(query);

  res.json({
    total: totalIssues,
    page: parseInt(page),
    limit: parseInt(limit),
    issues,
  });
}));

/**
 * @route GET /api/issues/:id
 * @desc Get a single issue by ID
 * @access Private (requires authentication)
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  // Validate if the provided ID is a valid Mongoose ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Issue ID format' });
  }

  // Find the issue by ID and populate related fields
  const issue = await Issue.findById(req.params.id)
    .populate('project', 'name')
    .populate('createdBy', 'username email')
    .populate('assignedTo', 'username email');

  // If issue not found, return 404
  if (!issue) {
    return res.status(404).json({ msg: 'Issue not found' });
  }

  res.json(issue);
}));

/**
 * @route POST /api/issues
 * @desc Create a new issue
 * @access Private (requires authentication)
 */
router.post('/', protect, asyncHandler(async (req, res) => {
  const { title, description, status, priority, type, project, assignedTo, dueDate } = req.body;

  // Basic request body validation
  if (!title || !project) {
    return res.status(400).json({ msg: 'Please enter title and project for the issue' });
  }

  // Validate Project existence
  if (!mongoose.Types.ObjectId.isValid(project)) {
    return res.status(400).json({ msg: 'Invalid Project ID format' });
  }
  const existingProject = await Project.findById(project);
  if (!existingProject) {
    return res.status(404).json({ msg: 'Project not found' });
  }

  // Validate AssignedTo User existence if an assigned user ID is provided
  let assignedToId = null;
  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({ msg: 'Invalid Assigned To User ID format' });
    }
    const existingUser = await User.findById(assignedTo);
    if (!existingUser) {
      return res.status(404).json({ msg: 'Assigned user not found' });
    }
    assignedToId = assignedTo; // Use the validated ID
  }

  // Create a new Issue instance
  const newIssue = new Issue({
    title,
    description,
    status,
    priority,
    type,
    project,
    createdBy: req.user.id, // The creator is the authenticated user
    assignedTo: assignedToId,
    dueDate,
  });

  // Save the new issue to the database
  const issue = await newIssue.save();
  res.status(201).json(issue); // Respond with the created issue and 201 status
}));

/**
 * @route PUT /api/issues/:id
 * @desc Update an issue
 * @access Private (requires authentication and ownership/admin rights)
 *
 * Note: In a production application, you would add more granular
 * authorization checks here (e.g., only creator or project admin can update).
 * For simplicity, any authenticated user can update for now, but this should be refined.
 */
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const { title, description, status, priority, type, project, assignedTo, dueDate } = req.body;

  // Validate Issue ID format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Issue ID format' });
  }

  let issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(404).json({ msg: 'Issue not found' });
  }

  // Optional: Authorization check (e.g., if (issue.createdBy.toString() !== req.user.id && req.user.role !== 'admin'))

  // Validate Project existence if 'project' field is being updated
  if (project && !mongoose.Types.ObjectId.isValid(project)) {
    return res.status(400).json({ msg: 'Invalid Project ID format' });
  }
  if (project) {
    const existingProject = await Project.findById(project);
    if (!existingProject) {
      return res.status(404).json({ msg: 'Project not found' });
    }
  }

  // Validate AssignedTo User existence if 'assignedTo' field is being updated
  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({ msg: 'Invalid Assigned To User ID format' });
    }
    const existingUser = await User.findById(assignedTo);
    if (!existingUser) {
      return res.status(404).json({ msg: 'Assigned user not found' });
    }
  } else if (assignedTo === null) {
      // Explicitly allow setting assignedTo to null (unassigning)
      issue.assignedTo = null;
  }

  // Update fields if provided in the request body
  issue.title = title || issue.title;
  // Use !== undefined to allow description to be explicitly set to an empty string
  issue.description = description !== undefined ? description : issue.description;
  issue.status = status || issue.status;
  issue.priority = priority || issue.priority;
  issue.type = type || issue.type;
  issue.project = project || issue.project;
  // Handle assignedTo update, including setting to null
  if (assignedTo !== undefined) issue.assignedTo = assignedTo;
  // Use !== undefined to allow dueDate to be explicitly set to null
  issue.dueDate = dueDate !== undefined ? dueDate : issue.dueDate;

  await issue.save(); // Save the updated issue
  res.json(issue);
}));

/**
 * @route DELETE /api/issues/:id
 * @desc Delete an issue
 * @access Private (requires authentication and ownership/admin rights)
 *
 * Note: The 'deleteOne' pre-hook in the Issue model will automatically delete
 * all associated comments when an issue is deleted.
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  // Validate Issue ID format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Issue ID format' });
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(404).json({ msg: 'Issue not found' });
  }

  // Authorization check: Only the creator can delete this issue (for now)
  if (issue.createdBy.toString() !== req.user.id) {
    return res.status(401).json({ msg: 'Not authorized to delete this issue' });
  }

  // Delete the issue. The 'deleteOne' pre-hook in the Issue model will handle cascading deletes for comments.
  // Use issue.deleteOne() to trigger the document middleware.
  await issue.deleteOne(); // CHANGED from issue.remove()

  res.json({ msg: 'Issue removed successfully' });
}));

// --- Comment Routes (Nested under Issues) ---

/**
 * @route GET /api/issues/:issueId/comments
 * @desc Get all comments for a specific issue
 * @access Private (requires authentication)
 */
router.get('/:issueId/comments', protect, asyncHandler(async (req, res) => {
  // Validate Issue ID format
  if (!mongoose.Types.ObjectId.isValid(req.params.issueId)) {
    return res.status(400).json({ msg: 'Invalid Issue ID format' });
  }

  // Check if the issue exists
  const issueExists = await Issue.findById(req.params.issueId);
  if (!issueExists) {
    return res.status(404).json({ msg: 'Issue not found' });
  }

  // Find all comments associated with the given issue ID
  const comments = await Comment.find({ issue: req.params.issueId })
    .populate('author', 'username email') // Populate author details
    .sort({ createdAt: 1 }); // Sort comments by creation date (oldest first)

  res.json(comments);
}));

/**
 * @route POST /api/issues/:issueId/comments
 * @desc Add a new comment to an issue
 * @access Private (requires authentication)
 */
router.post('/:issueId/comments', protect, asyncHandler(async (req, res) => {
  const { content } = req.body;

  // Basic validation for comment content
  if (!content) {
    return res.status(400).json({ msg: 'Comment content cannot be empty' });
  }

  // Validate Issue ID format
  if (!mongoose.Types.ObjectId.isValid(req.params.issueId)) {
    return res.status(400).json({ msg: 'Invalid Issue ID format' });
  }

  // Check if the issue exists
  const issueExists = await Issue.findById(req.params.issueId);
  if (!issueExists) {
    return res.status(404).json({ msg: 'Issue not found' });
  }

  // Create a new Comment instance
  const newComment = new Comment({
    content,
    issue: req.params.issueId,
    author: req.user.id, // The author is the authenticated user
  });

  const comment = await newComment.save(); // Save the new comment
  // Populate author information before sending the response
  await comment.populate('author', 'username email');
  res.status(201).json(comment); // Respond with the created comment and 201 status
}));

/**
 * @route DELETE /api/issues/:issueId/comments/:commentId
 * @desc Delete a specific comment
 * @access Private (requires authentication and comment ownership/admin rights)
 */
router.delete('/:issueId/comments/:commentId', protect, asyncHandler(async (req, res) => {
  // Validate both Issue ID and Comment ID formats
  if (!mongoose.Types.ObjectId.isValid(req.params.issueId) || !mongoose.Types.ObjectId.isValid(req.params.commentId)) {
    return res.status(400).json({ msg: 'Invalid Issue or Comment ID format' });
  }

  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return res.status(404).json({ msg: 'Comment not found' });
  }

  // Ensure the comment truly belongs to the specified issue to prevent unauthorized deletions
  if (comment.issue.toString() !== req.params.issueId) {
    return res.status(400).json({ msg: 'Comment does not belong to this issue' });
  }

  // Authorization check: Only the author of the comment can delete it (for now)
  if (comment.author.toString() !== req.user.id) {
    return res.status(401).json({ msg: 'Not authorized to delete this comment' });
  }

  // Use comment.deleteOne() to trigger the document middleware.
  await comment.deleteOne();

  res.json({ msg: 'Comment removed successfully' });
}));

module.exports = router;
