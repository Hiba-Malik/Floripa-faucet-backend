const { query } = require('../config/database');

class FaucetRequest {
  static async findByWalletAddress(walletAddress) {
    const text = 'SELECT * FROM faucet_requests WHERE wallet_address = $1';
    const result = await query(text, [walletAddress.toLowerCase()]);
    return result.rows[0];
  }

  static async create(walletAddress, tokenAmount) {
    const text = `
      INSERT INTO faucet_requests (wallet_address, total_tokens_received, request_count, last_request_time)
      VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await query(text, [walletAddress.toLowerCase(), tokenAmount]);
    return result.rows[0];
  }

  static async updateRequest(walletAddress, tokenAmount) {
    const text = `
      UPDATE faucet_requests 
      SET total_tokens_received = total_tokens_received + $2,
          request_count = request_count + 1,
          last_request_time = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE wallet_address = $1
      RETURNING *
    `;
    const result = await query(text, [walletAddress.toLowerCase(), tokenAmount]);
    return result.rows[0];
  }

  static async canRequest(walletAddress, cooldownHours = 24) {
    const text = `
      SELECT 
        wallet_address,
        last_request_time,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_request_time)) / 3600 as hours_since_last_request
      FROM faucet_requests 
      WHERE wallet_address = $1
    `;
    const result = await query(text, [walletAddress.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return { canRequest: true, reason: 'new_user' };
    }

    const hoursSinceLastRequest = result.rows[0].hours_since_last_request;
    const canRequest = hoursSinceLastRequest >= cooldownHours;
    
    return {
      canRequest,
      reason: canRequest ? 'cooldown_expired' : 'cooldown_active',
      hoursRemaining: canRequest ? 0 : Math.ceil(cooldownHours - hoursSinceLastRequest),
      lastRequestTime: result.rows[0].last_request_time
    };
  }

  static async getStats() {
    const text = `
      SELECT 
        COUNT(*) as total_users,
        SUM(total_tokens_received) as total_tokens_distributed,
        SUM(request_count) as total_requests,
        AVG(total_tokens_received) as avg_tokens_per_user
      FROM faucet_requests
    `;
    const result = await query(text);
    return result.rows[0];
  }
}

module.exports = FaucetRequest; 