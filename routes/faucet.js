const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const FaucetRequest = require('../models/FaucetRequest');
const blockchainService = require('../services/blockchain');

const router = express.Router();

// Track pending transactions to prevent duplicates
const pendingTransactions = new Set();

// Specific rate limit for faucet requests (more restrictive)
const faucetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Maximum 5 requests per hour per IP
  message: {
    error: 'Too many faucet requests. Please try again in an hour.',
    retryAfter: 3600
  }
});

// Validation schema
const requestTokensSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    })
});

// Request tokens endpoint
router.post('/request', faucetLimiter, async (req, res) => {
  try {
    // Validate request
    const { error, value } = requestTokensSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { walletAddress } = value;
    const faucetAmount = parseFloat(process.env.FAUCET_AMOUNT) || 0.5;
    const cooldownHours = parseInt(process.env.COOLDOWN_HOURS) || 24;

    // Validate wallet address
    if (!blockchainService.isValidAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address'
      });
    }

    // Check if there's already a pending transaction for this wallet
    if (pendingTransactions.has(walletAddress.toLowerCase())) {
      return res.status(429).json({
        error: 'Transaction in progress',
        message: 'Please wait for your previous transaction to complete before making another request.'
      });
    }

    // Check if user can make a request
    const canRequestInfo = await FaucetRequest.canRequest(walletAddress, cooldownHours);
    
    if (!canRequestInfo.canRequest) {
      return res.status(429).json({
        error: 'Request too soon',
        message: `You can request tokens again in ${canRequestInfo.hoursRemaining} hours`,
        hoursRemaining: canRequestInfo.hoursRemaining,
        lastRequestTime: canRequestInfo.lastRequestTime,
        cooldownHours: cooldownHours
      });
    }

    // Check admin balance before proceeding
    const adminBalance = await blockchainService.getAdminBalance();
    if (parseFloat(adminBalance) < faucetAmount) {
      return res.status(503).json({
        error: 'Faucet temporarily unavailable',
        message: 'Insufficient funds in faucet. Please try again later.'
      });
    }

    // Add wallet to pending transactions
    pendingTransactions.add(walletAddress.toLowerCase());
    
    let txResult;
    try {
      // Send tokens
      txResult = await blockchainService.sendTokens(walletAddress, faucetAmount);
    } finally {
      // Always remove from pending set, even if transaction fails
      pendingTransactions.delete(walletAddress.toLowerCase());
    }

    // Update or create database record
    let dbRecord;
    if (canRequestInfo.reason === 'new_user') {
      dbRecord = await FaucetRequest.create(walletAddress, faucetAmount);
    } else {
      dbRecord = await FaucetRequest.updateRequest(walletAddress, faucetAmount);
    }

    res.json({
      success: true,
      message: `Successfully sent ${faucetAmount} AZE to ${walletAddress}`,
      transaction: {
        hash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        amount: faucetAmount,
        recipient: walletAddress
      },
      user: {
        totalReceived: parseFloat(dbRecord.total_tokens_received),
        requestCount: dbRecord.request_count,
        nextRequestTime: new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Faucet request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Check user status endpoint
router.get('/status/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!blockchainService.isValidAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address'
      });
    }

    const cooldownHours = parseInt(process.env.COOLDOWN_HOURS) || 24;
    const canRequestInfo = await FaucetRequest.canRequest(walletAddress, cooldownHours);
    const userRecord = await FaucetRequest.findByWalletAddress(walletAddress);

    res.json({
      walletAddress: walletAddress,
      canRequest: canRequestInfo.canRequest,
      hoursRemaining: canRequestInfo.hoursRemaining,
      totalReceived: userRecord ? parseFloat(userRecord.total_tokens_received) : 0,
      requestCount: userRecord ? userRecord.request_count : 0,
      lastRequestTime: userRecord ? userRecord.last_request_time : null,
      nextRequestTime: canRequestInfo.canRequest ? 
        new Date().toISOString() : 
        new Date(Date.now() + canRequestInfo.hoursRemaining * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Faucet info endpoint
router.get('/info', async (req, res) => {
  try {
    const faucetAmount = parseFloat(process.env.FAUCET_AMOUNT) || 0.5;
    const cooldownHours = parseInt(process.env.COOLDOWN_HOURS) || 24;
    const adminBalance = await blockchainService.getAdminBalance();
    const networkInfo = await blockchainService.getNetworkInfo();
    const stats = await FaucetRequest.getStats();

    res.json({
      faucet: {
        amount: faucetAmount,
        symbol: 'AZE',
        cooldownHours: cooldownHours,
        adminBalance: parseFloat(adminBalance),
        isActive: parseFloat(adminBalance) >= faucetAmount
      },
      network: networkInfo,
      stats: {
        totalUsers: parseInt(stats.total_users) || 0,
        totalTokensDistributed: parseFloat(stats.total_tokens_distributed) || 0,
        totalRequests: parseInt(stats.total_requests) || 0,
        averageTokensPerUser: parseFloat(stats.avg_tokens_per_user) || 0
      }
    });

  } catch (error) {
    console.error('Info endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router; 