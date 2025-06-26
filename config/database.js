const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const targetDbName = process.env.DB_NAME || 'azore_faucet';

// Pool for the target database
let pool = new Pool({
  ...dbConfig,
  database: targetDbName,
});

const connectDB = async () => {
  try {
    // Try to connect to the target database
    const client = await pool.connect();
    console.log(`PostgreSQL connected successfully to database: ${targetDbName}`);
    client.release();
    
    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    // If connection fails, it might be because the database doesn't exist
    if (error.code === '3D000') { // Database does not exist
      console.log(`Database '${targetDbName}' does not exist. Creating it...`);
      await createDatabase();
      
      // Recreate pool with the new database
      pool = new Pool({
        ...dbConfig,
        database: targetDbName,
      });
      
      // Try connecting again
      const client = await pool.connect();
      console.log(`PostgreSQL connected successfully to newly created database: ${targetDbName}`);
      client.release();
      
      // Create tables
      await createTables();
    } else {
      console.error('Database connection error:', error);
      throw error;
    }
  }
};

const createDatabase = async () => {
  // Connect to the default 'postgres' database to create our target database
  const defaultPool = new Pool({
    ...dbConfig,
    database: 'postgres', // Connect to default postgres database
  });
  
  try {
    const client = await defaultPool.connect();
    
    // Check if database already exists
    const checkQuery = 'SELECT 1 FROM pg_database WHERE datname = $1';
    const result = await client.query(checkQuery, [targetDbName]);
    
    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      await client.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Database '${targetDbName}' created successfully`);
    } else {
      console.log(`Database '${targetDbName}' already exists`);
    }
    
    client.release();
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  } finally {
    await defaultPool.end();
  }
};

const createTables = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS faucet_requests (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(42) UNIQUE NOT NULL,
      total_tokens_received DECIMAL(18, 8) DEFAULT 0,
      last_request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      request_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_wallet_address ON faucet_requests(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_last_request_time ON faucet_requests(last_request_time);
  `;
  
  try {
    await pool.query(createTableQuery);
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  connectDB,
  query,
  getClient,
  pool
}; 