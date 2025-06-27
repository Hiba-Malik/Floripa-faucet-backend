const { query } = require('../config/database');

class FaucetRequest {
  static async findByWalletAddress(walletAddress) {
    const text = 'SELECT * FROM faucet_requests WHERE wallet_address = $1';
    const result = await query(text, [walletAddress.toLowerCase()]);
    return result.rows[0];
  }

  static async findByIPHash(ipHash) {
    const text = 'SELECT * FROM faucet_requests WHERE ip_hash = $1 ORDER BY last_request_time DESC';
    const result = await query(text, [ipHash]);
    return result.rows;
  }

  static async create(walletAddress, ipAddress, ipHash, tokenAmount) {
    const text = `
      INSERT INTO faucet_requests (wallet_address, ip_address, ip_hash, total_tokens_received, request_count, last_request_time)
      VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await query(text, [walletAddress.toLowerCase(), ipAddress, ipHash, tokenAmount]);
    return result.rows[0];
  }

  static async updateRequest(walletAddress, ipAddress, ipHash, tokenAmount) {
    const text = `
      UPDATE faucet_requests 
      SET total_tokens_received = total_tokens_received + $4,
          request_count = request_count + 1,
          last_request_time = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          ip_address = $2,
          ip_hash = $3
      WHERE wallet_address = $1
      RETURNING *
    `;
    const result = await query(text, [walletAddress.toLowerCase(), ipAddress, ipHash, tokenAmount]);
    return result.rows[0];
  }

  static async canRequest(walletAddress, ipHash, cooldownHours = 24) {
    // Check both wallet address and IP restrictions
    const walletCheck = await this.checkWalletCooldown(walletAddress, cooldownHours);
    const ipCheck = await this.checkIPCooldown(ipHash, cooldownHours);
    
    // User can request only if BOTH wallet AND IP are eligible
    const canRequest = walletCheck.canRequest && ipCheck.canRequest;
    
    // Return the most restrictive constraint
    if (!canRequest) {
      if (!walletCheck.canRequest && !ipCheck.canRequest) {
        // Both are restricted, return the one with longer wait time
        const walletHours = walletCheck.hoursRemaining || 0;
        const ipHours = ipCheck.hoursRemaining || 0;
        
        if (walletHours >= ipHours) {
          return {
            ...walletCheck,
            restrictionType: 'wallet_and_ip',
            additionalInfo: `IP also restricted for ${ipHours.toFixed(1)} hours`
          };
        } else {
          return {
            ...ipCheck,
            restrictionType: 'ip_and_wallet', 
            additionalInfo: `Wallet also restricted for ${walletHours.toFixed(1)} hours`
          };
        }
      } else if (!walletCheck.canRequest) {
        return { ...walletCheck, restrictionType: 'wallet' };
      } else {
        return { ...ipCheck, restrictionType: 'ip' };
      }
    }
    
    return {
      canRequest: true,
      reason: walletCheck.reason === 'new_user' && ipCheck.reason === 'new_user' ? 'new_user' : 'cooldown_expired',
      restrictionType: 'none'
    };
  }

  static async checkWalletCooldown(walletAddress, cooldownHours = 24) {
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

  static async checkIPCooldown(ipHash, cooldownHours = 24) {
    const text = `
      SELECT 
        ip_hash,
        last_request_time,
        wallet_address,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_request_time)) / 3600 as hours_since_last_request
      FROM faucet_requests 
      WHERE ip_hash = $1
      ORDER BY last_request_time DESC
      LIMIT 1
    `;
    const result = await query(text, [ipHash]);
    
    if (result.rows.length === 0) {
      return { canRequest: true, reason: 'new_ip' };
    }

    const hoursSinceLastRequest = result.rows[0].hours_since_last_request;
    const canRequest = hoursSinceLastRequest >= cooldownHours;
    
    return {
      canRequest,
      reason: canRequest ? 'cooldown_expired' : 'cooldown_active',
      hoursRemaining: canRequest ? 0 : Math.ceil(cooldownHours - hoursSinceLastRequest),
      lastRequestTime: result.rows[0].last_request_time,
      lastWalletUsed: result.rows[0].wallet_address
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