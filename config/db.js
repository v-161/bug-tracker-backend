// backend/config/db.js

const mongoose = require('mongoose');

// Function to connect to the MongoDB database
const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB using the URI from environment variables
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are now deprecated and have no effect in newer MongoDB Node.js driver versions (4.0.0+).
      // They are the default behavior, so you can safely remove or comment them out.
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    // If connection fails, log the error and exit the process
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1); // Exit process with failure code
  }
};

module.exports = connectDB; // Export the function to be used in server.js
