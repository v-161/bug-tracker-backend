// backend/routes/projects.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId for validation

// Import Mongoose models
const Project = require('../models/Project');
const User = require('../models/User');     // For populating members and validating user IDs
const Issue = require('../models/Issue');   // For cascading delete of issues

// --- Helper function for error handling ---
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @route GET /api/projects
 * @desc Get all projects (user's projects + public projects they are members of)
 * @access Private (requires authentication)
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  // Only fetch projects where the authenticated user is the creator or a member
  const query = {
    $or: [
      { createdBy: req.user.id },
      { 'members.user': req.user.id } // For members (if your project schema supports members array like this)
    ]
  };

  const projects = await Project.find(query)
    .populate('createdBy', 'username email') // Populate creator's details
    .populate({
      path: 'members.user', // Populate user details within the members array
      select: 'username email'
    });

  res.json(projects);
}));

/**
 * @route GET /api/projects/:id
 * @desc Get a single project by ID
 * @access Private (requires authentication and project membership/ownership)
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Project ID format' });
  }

  const project = await Project.findById(req.params.id)
    .populate('createdBy', 'username email')
    .populate({
      path: 'members.user',
      select: 'username email'
    });

  if (!project) {
    return res.status(404).json({ msg: 'Project not found' });
  }

  // Authorization: Only creator or a member can view the project
  // Ensure req.user and project.createdBy are properly defined before comparison
  const isCreator = req.user && project.createdBy && project.createdBy._id.toString() === req.user.id;
  const isMember = req.user && project.members.some(member => member.user && member.user._id.toString() === req.user.id);


  if (!isCreator && !isMember) {
    return res.status(401).json({ msg: 'Not authorized to view this project' });
  }

  res.json(project);
}));

/**
 * @route POST /api/projects
 * @desc Create a new project
 * @access Private (requires authentication)
 */
router.post('/', protect, asyncHandler(async (req, res) => {
  const { name, description, status, priority, members } = req.body;

  if (!name) {
    return res.status(400).json({ msg: 'Project name is required' });
  }

  // Check for existing project with the same name by the same user to prevent duplicates
  const existingProject = await Project.findOne({ name, createdBy: req.user.id });
  if (existingProject) {
    return res.status(400).json({ msg: 'You already have a project with this name' });
  }

  // Prepare members array, ensuring the creator is always a member with 'manager' role
  const projectMembers = [{ user: req.user.id, role: 'manager' }];

  if (members && Array.isArray(members) && members.length > 0) {
    for (const memberData of members) {
      // Ensure member is not the creator who is already added
      if (memberData.user === req.user.id.toString()) {
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(memberData.user)) {
        return res.status(400).json({ msg: `Invalid user ID format for member: ${memberData.user}` });
      }
      const userExists = await User.findById(memberData.user);
      if (!userExists) {
        return res.status(404).json({ msg: `User not found for member ID: ${memberData.user}` });
      }
      // Add member if not already in the list
      if (!projectMembers.some(pm => pm.user.toString() === memberData.user)) {
        projectMembers.push({ user: memberData.user, role: memberData.role || 'developer' }); // Default role
      }
    }
  }

  const newProject = new Project({
    name,
    description,
    status,
    priority,
    createdBy: req.user.id, // Set creator to the authenticated user
    members: projectMembers, // Assign the prepared members array
  });

  const project = await newProject.save();
  // Populate creator and members before sending response
  await project.populate('createdBy', 'username email');
  await project.populate({
    path: 'members.user',
    select: 'username email'
  });

  res.status(201).json(project); // Ensure this sends back the created project object
}));

/**
 * @route PUT /api/projects/:id
 * @desc Update a project
 * @access Private (requires authentication and ownership/admin rights)
 */
router.put('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Project ID format' });
  }

  let project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({ msg: 'Project not found' });
  }

  // Authorization: Only the creator of the project or an admin can update it
  if (project.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(401).json({ msg: 'Not authorized to update this project' });
  }

  const { name, description, status, priority, members } = req.body;

  // Update basic fields
  project.name = name || project.name;
  project.description = description !== undefined ? description : project.description;
  project.status = status || project.status;
  project.priority = priority || project.priority;

  // Handle members update: Ensure creator remains, and other members are handled
  if (members !== undefined && Array.isArray(members)) {
    const updatedMembers = [];
    // Ensure the original creator remains a member with their original role (or manager if not specified)
    const creatorMember = project.members.find(m => m.user.toString() === project.createdBy.toString());
    if (creatorMember) {
        updatedMembers.push({ user: creatorMember.user, role: creatorMember.role || 'manager' });
    } else {
        // Fallback: Add creator if for some reason they weren't in the original members array
        updatedMembers.push({ user: project.createdBy, role: 'manager' });
    }


    for (const memberData of members) {
      // Skip if the member being processed is the creator (already added)
      if (memberData.user === project.createdBy.toString()) {
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(memberData.user)) {
        return res.status(400).json({ msg: `Invalid user ID format for member: ${memberData.user}` });
      }
      const userExists = await User.findById(memberData.user);
      if (!userExists) {
        return res.status(404).json({ msg: `User not found for member ID: ${memberData.user}` });
      }
      // Add member if not already in the updatedMembers list
      if (!updatedMembers.some(um => um.user.toString() === memberData.user)) {
        updatedMembers.push({ user: memberData.user, role: memberData.role || 'developer' });
      }
    }
    project.members = updatedMembers; // Replace entire members array
  }

  await project.save();
  // Populate fields before sending response
  await project.populate('createdBy', 'username email');
  await project.populate({
    path: 'members.user',
    select: 'username email'
  });

  res.json(project);
}));

/**
 * @route DELETE /api/projects/:id
 * @desc Delete a project
 * @access Private (requires authentication and ownership/admin rights)
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid Project ID format' });
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({ msg: 'Project not found' });
  }

  // Authorization: Only the creator of the project or an admin can delete it
  if (project.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(401).json({ msg: 'Not authorized to delete this project' });
  }

  // Delete all issues associated with this project first
  await Issue.deleteMany({ project: req.params.id });

  await project.deleteOne(); // Use deleteOne() instead of remove() for newer Mongoose versions

  res.json({ msg: 'Project removed successfully and associated issues deleted' });
}));

module.exports = router;
