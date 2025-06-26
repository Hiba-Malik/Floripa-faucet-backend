# Azore Faucet Backend

A Node.js Express backend for the Azore blockchain faucet that distributes AZE tokens to users with rate limiting and database tracking.

## Features

- **Rate-limited token distribution**: Users can request tokens once every 24 hours
- **Database tracking**: PostgreSQL database tracks user requests and statistics
- **Blockchain integration**: Direct integration with Azore network via Web3
- **Security**: Rate limiting, input validation, and security headers
- **RESTful API**: Clean API endpoints for faucet operations

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Azore network running on `localhost:10001`
- Admin wallet with AZE tokens for distribution

## Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=azore_faucet
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # Blockchain Configuration
   RPC_URL=http://localhost:10001
   ADMIN_PRIVATE_KEY=your_admin_wallet_private_key
   ADMIN_ADDRESS=your_admin_wallet_address

   # Faucet Configuration
   FAUCET_AMOUNT=0.5
   COOLDOWN_HOURS=24
   ```

3. **Start the application:**
   ```bash
   npm start
   ```
   
   The application will automatically:
   - Create the database if it doesn't exist
   - Create the required tables
   - Start the server

   Alternatively, you can initialize just the database without starting the server:
   ```bash
   npm run init-db
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Health Check
```http
GET /health
```

Returns server status and basic information.

### Request Tokens
```http
POST /api/faucet/request
Content-Type: application/json

{
  "walletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully sent 0.5 AZE to 0x1234567890123456789012345678901234567890",
  "transaction": {
    "hash": "0x...",
    "blockNumber": "12345",
    "amount": 0.5,
    "recipient": "0x1234567890123456789012345678901234567890"
  },
  "user": {
    "totalReceived": 0.5,
    "requestCount": 1,
    "nextRequestTime": "2024-01-02T12:00:00.000Z"
  }
}
```

### Check User Status
```http
GET /api/faucet/status/0x1234567890123456789012345678901234567890
```

**Response:**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "canRequest": false,
  "hoursRemaining": 12,
  "totalReceived": 0.5,
  "requestCount": 1,
  "lastRequestTime": "2024-01-01T12:00:00.000Z",
  "nextRequestTime": "2024-01-02T12:00:00.000Z"
}
```

### Faucet Information
```http
GET /api/faucet/info
```

**Response:**
```json
{
  "faucet": {
    "amount": 0.5,
    "symbol": "AZE",
    "cooldownHours": 24,
    "adminBalance": 1000.0,
    "isActive": true
  },
  "network": {
    "chainId": "1234",
    "blockNumber": "12345",
    "gasPrice": "20 Gwei",
    "networkName": "Azore",
    "symbol": "AZE"
  },
  "stats": {
    "totalUsers": 150,
    "totalTokensDistributed": 75.0,
    "totalRequests": 200,
    "averageTokensPerUser": 0.5
  }
}
```

## Database Schema

### faucet_requests table
```sql
CREATE TABLE faucet_requests (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  total_tokens_received DECIMAL(18, 8) DEFAULT 0,
  last_request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Faucet requests**: 5 requests per hour per IP
- **User cooldown**: 24 hours between token requests per wallet

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (invalid wallet address, validation errors)
- `429`: Too many requests (rate limiting or cooldown active)
- `500`: Internal server error
- `503`: Service unavailable (insufficient faucet funds)

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate limiting**: Multiple layers of rate limiting
- **Input validation**: Joi schema validation
- **SQL injection prevention**: Parameterized queries

## Monitoring

Check the health endpoint regularly:
```bash
curl http://localhost:3000/health
```

Monitor logs for errors and performance issues.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License 