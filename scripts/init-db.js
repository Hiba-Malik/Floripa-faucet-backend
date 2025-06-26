const { connectDB } = require('../config/database');

const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    await connectDB();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

initializeDatabase(); 