const crypto = require('crypto');

class IPUtils {
  /**
   * Extract real IP address from request, considering proxies and load balancers
   */
  static getRealIP(req) {
    return (
      req.headers['cf-connecting-ip'] ||           // Cloudflare
      req.headers['x-real-ip'] ||                  // Nginx proxy
      req.headers['x-forwarded-for']?.split(',')[0] || // Load balancer
      req.connection?.remoteAddress ||             // Direct connection
      req.socket?.remoteAddress ||                 // Socket connection
      req.ip ||                                    // Express.js
      'unknown'
    );
  }

  /**
   * Hash IP address for privacy (one-way hash)
   */
  static hashIP(ipAddress) {
    if (!ipAddress || ipAddress === 'unknown') {
      return 'unknown';
    }
    
    // Use SHA-256 with a salt for privacy
    const salt = process.env.IP_HASH_SALT || 'azore-faucet-salt-2024';
    return crypto
      .createHash('sha256')
      .update(ipAddress + salt)
      .digest('hex');
  }

  /**
   * Validate IP address format
   */
  static isValidIP(ip) {
    if (!ip || ip === 'unknown') return false;
    
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is from localhost/private network (for development)
   */
  static isLocalIP(ip) {
    if (!ip) return false;
    
    const localPatterns = [
      /^127\./,          // localhost IPv4
      /^192\.168\./,     // private network
      /^10\./,           // private network
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // private network
      /^::1$/,           // localhost IPv6
      /^::ffff:127\./    // IPv4-mapped IPv6 localhost
    ];
    
    return localPatterns.some(pattern => pattern.test(ip));
  }
}

module.exports = IPUtils; 