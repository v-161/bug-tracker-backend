// backend/server.js

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error'); // Import your custom error handler
const cookieParser = require('cookie-parser'); // Import the cookie-parser middleware
const cors = require('cors'); // Import the CORS middleware

// Load environment variables from .env file
// Ensure path to config.env is correct if using that instead of just .env
dotenv.config({ path: './config/config.env' });

// Connect to MongoDB database
connectDB();

const app = express();

// Middleware: Enable CORS for all routes to allow frontend to communicate
// Configure CORS to allow specific origin and support credentials
const corsOptions = {
  // Use the CLIENT_ORIGIN environment variable for the allowed origin.
  // This should be your deployed frontend URL (e.g., https://your-app-name.vercel.app)
  // During local development, you might set this to http://localhost:3000 in config.env
  // For production deployment, this MUST be your actual deployed frontend URL.
  origin: process.env.CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'], // Allow these headers
  credentials: true // Allow cookies and authentication headers
};
app.use(cors(corsOptions)); // Apply CORS middleware with configured options

// Middleware: Parse JSON request bodies
// This allows you to receive JSON data sent from the frontend in req.body
app.use(express.json());

// Middleware: Parse cookies
// This makes cookies available in req.cookies
app.use(cookieParser());

// Define Routes
// These are the API endpoints for different parts of your application.
// Authentication routes (for user registration and login)
app.use('/api/auth', require('./routes/auth'));

// Project Management routes
app.use('/api/projects', require('./routes/projects'));

// Issue Management routes
app.use('/api/issues', require('./routes/issues'));

// User Management routes (for fetching lists of users for assignment, etc.)
// Make sure you have a './routes/users' file or this will cause an error
app.use('/api/users', require('./routes/users'));

// Basic test route for the root URL
app.get('/', (req, res) => {
  res.send('Bug Tracker API is running...');
});

// Error handling middleware
// This must be placed after all route mountings
// Make sure you have a './middleware/error' file or this will cause an error
app.use(errorHandler);

// Set the port for the server to listen on
// It will use the PORT from config.env, or default to 5000
const PORT = process.env.PORT || 5000;

// Start the Express server
const server = app.listen(
  PORT,
  // Using process.env.NODE_ENV for better context in console log
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
// This provides a graceful shutdown in case of unhandled async errors
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
