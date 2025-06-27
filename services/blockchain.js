const { Web3 } = require('web3');

class BlockchainService {
  constructor() {
    const rpcUrl = process.env.RPC_URL || 'http://localhost:10001';
    console.log(`🔗 Initializing Web3 with RPC: ${rpcUrl}`);
    
    this.web3 = new Web3(rpcUrl);
    this.adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    this.adminAddress = process.env.ADMIN_ADDRESS;
    
    if (this.adminPrivateKey && !this.adminPrivateKey.startsWith('0x')) {
      this.adminPrivateKey = '0x' + this.adminPrivateKey;
    }
    
    // Test connection on initialization
    this.testConnection();
  }

  async testConnection() {
    try {
      console.log('🧪 Testing blockchain connection...');
      const isConnected = await this.web3.eth.net.isListening();
      const chainId = await this.web3.eth.getChainId();
      console.log(`✅ Blockchain connected! Chain ID: ${chainId}`);
      return true;
    } catch (error) {
      console.error('❌ Blockchain connection failed:', error.message);
      console.error('🔍 Check your RPC_URL in .env file');
      console.error('🔍 Make sure your Azore network is running on the correct port');
      return false;
    }
  }

  async isValidAddress(address) {
    try {
      return this.web3.utils.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getBalance(address) {
    try {
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
  }

  async getAdminBalance() {
    try {
      return await this.getBalance(this.adminAddress);
    } catch (error) {
      console.error('Error getting admin balance:', error);
      throw new Error('Failed to get admin balance');
    }
  }

  async sendTokens(toAddress, amount) {
    try {
      if (!this.adminPrivateKey) {
        throw new Error('Admin private key not configured');
      }

      const account = this.web3.eth.accounts.privateKeyToAccount(this.adminPrivateKey);
      this.web3.eth.accounts.wallet.add(account);

      // Get the current nonce to prevent "already known" errors
      const nonce = await this.web3.eth.getTransactionCount(this.adminAddress, 'pending');

      // Test address for gas fee verification
      const testAddress = '0x4717779fF88dBEfF245b8E591c1DE706BBfD538d';
      
      console.log('\n=== TRANSFER TEST START ===');
      
      // Check balances BEFORE transfer
      const adminBalanceBefore = await this.getAdminBalance();
      const recipientBalanceBefore = await this.getBalance(toAddress);
      const testAddressBalanceBefore = await this.getBalance(testAddress);
      
      console.log('📊 BALANCES BEFORE TRANSFER:');
      console.log(`   Admin (${this.adminAddress}): ${adminBalanceBefore} AZE`);
      console.log(`   Recipient (${toAddress}): ${recipientBalanceBefore} AZE`);
      console.log(`   Test Address (${testAddress}): ${testAddressBalanceBefore} AZE`);

      if (parseFloat(adminBalanceBefore) < amount) {
        throw new Error(`Insufficient admin balance. Available: ${adminBalanceBefore} AZE, Required: ${amount} AZE`);
      }

      // Get current gas price
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasPriceInGwei = this.web3.utils.fromWei(gasPrice, 'gwei');
      
      console.log(`⛽ GAS PRICE DEBUGGING:`);
      console.log(`   Raw Gas Price: ${gasPrice.toString()}`);
      console.log(`   Gas Price in Wei: ${gasPrice}`);
      console.log(`   Gas Price in Gwei: ${gasPriceInGwei}`);
      console.log(`   Gas Price in Ether: ${this.web3.utils.fromWei(gasPrice, 'ether')}`);
      
      // Estimate gas
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.adminAddress,
        to: toAddress,
        value: this.web3.utils.toWei(amount.toString(), 'ether')
      });

      console.log(`📏 GAS ESTIMATE: ${gasEstimate.toString()} units`);

      // Calculate estimated gas fee
      const estimatedGasFee = BigInt(gasPrice) * BigInt(gasEstimate);
      const estimatedGasFeeInEther = this.web3.utils.fromWei(estimatedGasFee.toString(), 'ether');
      
      console.log(`💰 GAS FEE CALCULATION (ESTIMATED):`);
      console.log(`   Gas Price (Wei): ${gasPrice.toString()}`);
      console.log(`   Gas Estimate: ${gasEstimate.toString()}`);
      console.log(`   Calculation: ${gasPrice.toString()} × ${gasEstimate.toString()} = ${estimatedGasFee.toString()}`);
      console.log(`   Gas Fee in Wei: ${estimatedGasFee.toString()}`);
      console.log(`   Gas Fee in AZE: ${estimatedGasFeeInEther}`);

      // Force a minimum gas price if it's 0 (to test normal gas behavior)
      let actualGasPrice = gasPrice;
      if (gasPrice.toString() === '0') {
        console.log('🚨 DETECTED 0 GAS PRICE - Admin has special privileges!');
        console.log('💡 This explains why your transactions are free while others pay gas');
        
        // Optionally force a normal gas price for testing
        // actualGasPrice = this.web3.utils.toWei('8', 'gwei'); // Use 8 Gwei like other users
        // console.log(`🔧 FORCING GAS PRICE TO: ${this.web3.utils.fromWei(actualGasPrice, 'gwei')} Gwei`);
      }

      // Create transaction with explicit nonce
      const transaction = {
        from: this.adminAddress,
        to: toAddress,
        value: this.web3.utils.toWei(amount.toString(), 'ether'),
        gas: gasEstimate,
        gasPrice: actualGasPrice,
        nonce: nonce
      };

      console.log(`🔢 USING NONCE: ${nonce}`);

      // Send transaction
      console.log('🚀 SENDING TRANSACTION...');
      const signedTx = await this.web3.eth.accounts.signTransaction(transaction, this.adminPrivateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      console.log(`✅ TRANSACTION SUCCESS: ${receipt.transactionHash}`);

      // Calculate actual gas fee
      const effectiveGasPrice = receipt.effectiveGasPrice || actualGasPrice;
      const actualGasFee = BigInt(receipt.gasUsed) * BigInt(effectiveGasPrice);
      const actualGasFeeInEther = this.web3.utils.fromWei(actualGasFee.toString(), 'ether');
      
      console.log(`💸 GAS FEE CALCULATION (ACTUAL):`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()} units`);
      console.log(`   Effective Gas Price (Wei): ${effectiveGasPrice.toString()}`);
      console.log(`   Effective Gas Price (Gwei): ${this.web3.utils.fromWei(effectiveGasPrice.toString(), 'gwei')}`);
      console.log(`   Calculation: ${receipt.gasUsed.toString()} × ${effectiveGasPrice.toString()} = ${actualGasFee.toString()}`);
      console.log(`   Gas Fee in Wei: ${actualGasFee.toString()}`);
      console.log(`   Gas Fee in AZE: ${actualGasFeeInEther}`);

      // Check balances AFTER transfer
      const adminBalanceAfter = await this.getAdminBalance();
      const recipientBalanceAfter = await this.getBalance(toAddress);
      const testAddressBalanceAfter = await this.getBalance(testAddress);
      
      console.log('\n📊 BALANCES AFTER TRANSFER:');
      console.log(`   Admin (${this.adminAddress}): ${adminBalanceAfter} AZE`);
      console.log(`   Recipient (${toAddress}): ${recipientBalanceAfter} AZE`);
      console.log(`   Test Address (${testAddress}): ${testAddressBalanceAfter} AZE`);

      // Calculate balance changes
      const adminChange = parseFloat(adminBalanceAfter) - parseFloat(adminBalanceBefore);
      const recipientChange = parseFloat(recipientBalanceAfter) - parseFloat(recipientBalanceBefore);
      const testAddressChange = parseFloat(testAddressBalanceAfter) - parseFloat(testAddressBalanceBefore);
      
      console.log('\n📈 BALANCE CHANGES ANALYSIS:');
      console.log(`   Admin: ${adminChange > 0 ? '+' : ''}${adminChange.toFixed(8)} AZE`);
      console.log(`   Recipient: ${recipientChange > 0 ? '+' : ''}${recipientChange.toFixed(8)} AZE`);
      console.log(`   Test Address: ${testAddressChange > 0 ? '+' : ''}${testAddressChange.toFixed(8)} AZE`);
      
      console.log('\n🔍 ADMIN BALANCE ANALYSIS:');
      console.log(`   Expected admin change: -${amount} AZE (transfer) - ${actualGasFeeInEther} AZE (gas) = -${(parseFloat(amount) + parseFloat(actualGasFeeInEther)).toFixed(8)} AZE`);
      console.log(`   Actual admin change: ${adminChange > 0 ? '+' : ''}${adminChange.toFixed(8)} AZE`);
      console.log(`   Difference: ${(adminChange - (-(parseFloat(amount) + parseFloat(actualGasFeeInEther)))).toFixed(8)} AZE`);
      
      if (adminChange > 0) {
        console.log(`   🚨 ANOMALY: Admin balance INCREASED instead of decreased!`);
        console.log(`   🔍 Possible causes:`);
        console.log(`      - Admin address is receiving block rewards (mining/validating)`);
        console.log(`      - Network has special gas fee redistribution`);
        console.log(`      - Admin address is receiving transaction fees`);
        console.log(`      - Admin has validator privileges with 0 gas fees`);
      }

      // Check if test address received 50% of gas fees
      const expectedGasFeeShare = parseFloat(actualGasFeeInEther) * 0.5;
      const actualGasFeeReceived = testAddressChange;
      
      console.log('\n🔍 GAS FEE ANALYSIS:');
      console.log(`   Total Gas Fee: ${actualGasFeeInEther} AZE`);
      console.log(`   Expected 50% Share: ${expectedGasFeeShare.toFixed(8)} AZE`);
      console.log(`   Actually Received: ${actualGasFeeReceived.toFixed(8)} AZE`);
      
      const percentageReceived = expectedGasFeeShare > 0 ? (actualGasFeeReceived / expectedGasFeeShare * 100) : 0;
      console.log(`   Percentage of Expected: ${percentageReceived.toFixed(2)}%`);
      
      if (Math.abs(actualGasFeeReceived - expectedGasFeeShare) < 0.000001) {
        console.log('   ✅ TEST ADDRESS RECEIVED CORRECT 50% GAS FEE SHARE!');
      } else if (actualGasFeeReceived > 0) {
        console.log('   ⚠️  TEST ADDRESS RECEIVED SOME GAS FEES BUT NOT EXACTLY 50%');
      } else {
        console.log('   ❌ TEST ADDRESS DID NOT RECEIVE ANY GAS FEES');
        if (actualGasFeeInEther === '0') {
          console.log('   ℹ️  This is expected since total gas fee was 0 AZE');
        }
      }

      console.log('=== TRANSFER TEST END ===\n');

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        amount: amount,
        // Additional test data
        gasAnalysis: {
          estimatedGasFee: parseFloat(estimatedGasFeeInEther),
          actualGasFee: parseFloat(actualGasFeeInEther),
          testAddressChange: parseFloat(testAddressChange.toFixed(8)),
          expectedGasFeeShare: parseFloat(expectedGasFeeShare.toFixed(8)),
          percentageReceived: parseFloat(percentageReceived.toFixed(2))
        }
      };

    } catch (error) {
      console.error('Error sending tokens:', error);
      
      // Handle specific "already known" error
      if (error.message && error.message.includes('already known')) {
        throw new Error('Transaction already submitted. Please wait for the previous transaction to complete before making another request.');
      }
      
      // Handle nonce too low error
      if (error.message && error.message.includes('nonce too low')) {
        throw new Error('Transaction nonce error. Please try again in a few seconds.');
      }
      
      throw new Error(`Failed to send tokens: ${error.message}`);
    }
  }

  async getNetworkInfo() {
    try {
      const chainId = await this.web3.eth.getChainId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      const gasPrice = await this.web3.eth.getGasPrice();

      return {
        chainId: chainId.toString(),
        blockNumber: blockNumber.toString(),
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei') + ' Gwei',
        networkName: 'Azore',
        symbol: 'AZE'
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      throw new Error('Failed to get network information');
    }
  }
}

module.exports = new BlockchainService(); 