require('dotenv').config();

console.log('🔍 Configuration Check:');
console.log('========================');
console.log(`PORT: ${process.env.PORT || '3000 (default)'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development (default)'}`);
console.log('');
console.log('🗄️  Database Configuration:');
console.log(`DB_HOST: ${process.env.DB_HOST || 'localhost (default)'}`);
console.log(`DB_PORT: ${process.env.DB_PORT || '5432 (default)'}`);
console.log(`DB_NAME: ${process.env.DB_NAME || 'azore_faucet (default)'}`);
console.log(`DB_USER: ${process.env.DB_USER || 'NOT SET ❌'}`);
console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '****** (set)' : 'NOT SET ❌'}`);
console.log('');
console.log('⛓️  Blockchain Configuration:');
console.log(`RPC_URL: ${process.env.RPC_URL || 'http://localhost:10001 (default)'}`);
console.log(`ADMIN_PRIVATE_KEY: ${process.env.ADMIN_PRIVATE_KEY ? '****** (set)' : 'NOT SET ❌'}`);
console.log(`ADMIN_ADDRESS: ${process.env.ADMIN_ADDRESS || 'NOT SET ❌'}`);
console.log('');
console.log('💰 Faucet Configuration:');
console.log(`FAUCET_AMOUNT: ${process.env.FAUCET_AMOUNT || '0.5 (default)'}`);
console.log(`COOLDOWN_HOURS: ${process.env.COOLDOWN_HOURS || '24 (default)'}`);
console.log('');
console.log('🔒 Security Configuration:');
console.log(`RATE_LIMIT_WINDOW_MS: ${process.env.RATE_LIMIT_WINDOW_MS || '900000 (default)'}`);
console.log(`RATE_LIMIT_MAX_REQUESTS: ${process.env.RATE_LIMIT_MAX_REQUESTS || '100 (default)'}`);
console.log(`IP_HASH_SALT: ${process.env.IP_HASH_SALT ? '****** (set)' : 'azore-faucet-salt-2024 (default)'}`);
console.log('');

// Check for missing critical configuration
const missing = [];
if (!process.env.DB_USER) missing.push('DB_USER');
if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
if (!process.env.ADMIN_PRIVATE_KEY) missing.push('ADMIN_PRIVATE_KEY');
if (!process.env.ADMIN_ADDRESS) missing.push('ADMIN_ADDRESS');

if (missing.length > 0) {
  console.log('⚠️  Missing Required Configuration:');
  missing.forEach(key => console.log(`   - ${key}`));
  console.log('');
  console.log('📝 Please create a .env file with these values.');
  console.log('📋 Copy from env.example and fill in your values.');
} else {
  console.log('✅ All required configuration is set!');
}

console.log('========================'); 