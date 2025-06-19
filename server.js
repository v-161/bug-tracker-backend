// backend/server.js

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error'); // Import your custom error handler
const cookieParser = require('cookie-parser'); // Import the cookie-parser middleware
const cors = require('cors'); // Import the CORS middleware

// Load environment variables from .env file
dotenv.config({ path: './config/config.env' }); // Ensure path to config.env is correct

// Connect to MongoDB database
connectDB();

const app = express();

// Middleware: Enable CORS for all routes to allow frontend to communicate
// Configure CORS to allow specific origin and support credentials
app.use(cors({
  origin: 'http://localhost:3000', // Your frontend's URL
  credentials: true, // Allow cookies (e.g., for JWTs) to be sent with requests
}));

// Middleware: Parse JSON request bodies
// This allows you to receive JSON data sent from the frontend in req.body
app.use(express.json());

// Middleware: Parse cookies
// This makes cookies available in req.cookies
app.use(cookieParser()); // <--- ADDED: Cookie parser middleware

// Define Routes
// These are the API endpoints for different parts of your application.

// Authentication routes (for user registration and login)
app.use('/api/auth', require('./routes/auth'));

// Project Management routes
app.use('/api/projects', require('./routes/projects'));

// Issue Management routes
app.use('/api/issues', require('./routes/issues'));

// User Management routes (for fetching lists of users for assignment, etc.)
app.use('/api/users', require('./routes/users')); // <--- ADDED: Mounting the users route

// Basic test route for the root URL
app.get('/', (req, res) => {
  res.send('Bug Tracker API is running...');
});

// Error handling middleware
// This must be placed after all route mountings
app.use(errorHandler); // <--- ADDED: Global error handler

// Set the port for the server to listen on
// It will use the PORT from .env, or default to 5000
const PORT = process.env.PORT || 5000;

// Start the Express server
const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
// This provides a graceful shutdown in case of unhandled async errors
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
