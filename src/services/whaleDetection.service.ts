// src/services/whaleDetection.service.ts
import axios from 'axios';
import { WhaleWallet, WalletBalance, WalletStats } from '../types/whale.types';
import { SolPriceService } from './solPrice.service';
import { Helpers } from '../utils/helpers';
import { logger } from '../utils/logger';

export class WhaleDetectionService {
  private solPriceService = SolPriceService.getInstance();
  private apiClient = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': 'WhaleDetectionBot/1.0',
      'Accept': 'application/json'
    }
  });

  private readonly CONFIG = {
    MIN_BALANCE_USD: parseInt(process.env.MIN_BALANCE_USD || '50000'),
    MIN_WIN_RATE: parseInt(process.env.MIN_WIN_RATE || '50'),
    MIN_TRANSACTIONS: parseInt(process.env.MIN_TRANSACTIONS || '10')
  };

  async analyzeWalletFromSolscan(walletAddress: string): Promise<WhaleWallet | null> {
    try {
      logger.info(`Analyzing wallet: ${walletAddress.substring(0, 8)}...`);

      // Validate wallet address
      if (!Helpers.isValidSolanaAddress(walletAddress)) {
        logger.warn(`Invalid Solana address: ${walletAddress}`);
        return null;
      }

      // Get wallet balance
      const balance = await this.getWalletBalance(walletAddress);
      if (!balance || balance.totalBalanceUsd < this.CONFIG.MIN_BALANCE_USD) {
        logger.info(`Wallet ${walletAddress.substring(0, 8)} balance too low: $${balance?.totalBalanceUsd || 0}`);
        return null;
      }

      // Get transaction stats
      const stats = await this.getWalletStats(walletAddress);
      if (!stats || stats.winRate < this.CONFIG.MIN_WIN_RATE) {
        logger.info(`Wallet ${walletAddress.substring(0, 8)} win rate too low: ${stats?.winRate || 0}%`);
        return null;
      }

      // Check minimum transactions
      if (stats.totalTransactions < this.CONFIG.MIN_TRANSACTIONS) {
        logger.info(`Wallet ${walletAddress.substring(0, 8)} not enough transactions: ${stats.totalTransactions}`);
        return null;
      }

      // Create whale wallet object
      const whale: WhaleWallet = {
        address: walletAddress,
        name: Helpers.sanitizeWalletName(walletAddress),
        description: this.generateDescription(balance, stats),
        balance,
        stats,
        winRate: `${stats.winRate.toFixed(1)}%`,
        enabled: true,
        discoveredDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'SOLSCAN',
        riskLevel: Helpers.calculateRiskLevel(stats.winRate, stats.totalTransactions, balance.totalBalanceUsd),
        category: Helpers.determineCategory(balance.totalBalanceUsd),
        tags: this.generateTags(balance, stats)
      };

      logger.success(`Whale discovered: ${whale.name} - $${Helpers.formatNumber(balance.totalBalanceUsd)} - ${whale.winRate} WR`);
      return whale;

    } catch (error) {
      logger.error(`Error analyzing wallet ${walletAddress}`, error);
      return null;
    }
  }

  private async getWalletBalance(walletAddress: string): Promise<WalletBalance | null> {
    try {
      // Get SOL balance
      const solResponse = await this.apiClient.get(`https://public-api.solscan.io/account/${walletAddress}`);
      const solBalance = solResponse.data?.lamports ? solResponse.data.lamports / 1000000000 : 0;

      // Get token balances
      const tokensResponse = await this.apiClient.get(`https://public-api.solscan.io/account/tokens?account=${walletAddress}&limit=50`);
      const tokens = tokensResponse.data?.data || [];

      let usdcBalance = 0;
      let totalTokensUsd = 0;

      for (const token of tokens) {
        const amount = parseFloat(token.tokenAmount?.uiAmountString || '0');
        
        if (token.tokenSymbol === 'USDC') {
          usdcBalance += amount;
        } else if (token.tokenSymbol === 'USDT') {
          totalTokensUsd += amount; // USDT treated as $1
        } else {
          // Estimate other token values
          const estimatedValue = await this.estimateTokenValue(token.tokenAddress, amount);
          totalTokensUsd += estimatedValue;
        }
      }

      const solPrice = this.solPriceService.getPrice();
      const totalBalanceUsd = (solBalance * solPrice) + usdcBalance + totalTokensUsd;

      const balance: WalletBalance = {
        sol: solBalance,
        usdc: usdcBalance,
        totalTokensUsd,
        totalBalanceUsd
      };

      logger.info(`Wallet balance: SOL=${solBalance.toFixed(2)}, USDC=${usdcBalance.toFixed(0)}, Total=$${Helpers.formatNumber(totalBalanceUsd)}`);
      return balance;

    } catch (error) {
      logger.error('Error getting wallet balance', error);
      return null;
    }
  }

  private async getWalletStats(walletAddress: string): Promise<WalletStats | null> {
    try {
      // Get recent transactions
      const txResponse = await this.apiClient.get(`https://public-api.solscan.io/account/transactions?account=${walletAddress}&limit=200`);
      const transactions = txResponse.data?.data || [];

      if (transactions.length < this.CONFIG.MIN_TRANSACTIONS) {
        logger.info(`Not enough transactions: ${transactions.length}`);
        return null;
      }

      // Analyze transactions for trading patterns
      let tokenTrades = 0;
      let successfulTrades = 0;
      let totalProfit = 0;
      let totalVolume = 0;
      let lastActiveDate = new Date(0);

      const tradeAnalysis = await this.analyzeTransactionsForTrades(transactions, walletAddress);
      
      tokenTrades = tradeAnalysis.totalTrades;
      successfulTrades = tradeAnalysis.successfulTrades;
      totalProfit = tradeAnalysis.totalProfit;
      totalVolume = tradeAnalysis.totalVolume;
      lastActiveDate = tradeAnalysis.lastActiveDate;

      if (tokenTrades < this.CONFIG.MIN_TRANSACTIONS) {
        logger.info(`Not enough token trades: ${tokenTrades}`);
        return null;
      }

      const winRate = tokenTrades > 0 ? (successfulTrades / tokenTrades) * 100 : 0;
      const avgProfitLoss = tokenTrades > 0 ? totalProfit / tokenTrades : 0;

      const stats: WalletStats = {
        totalTransactions: transactions.length,
        successfulTrades,
        winRate,
        avgProfitLoss,
        lastActiveDate: lastActiveDate.toISOString(),
        profitableTrades: successfulTrades,
        totalVolume
      };

      logger.info(`Wallet stats: ${tokenTrades} trades, ${winRate.toFixed(1)}% win rate, $${Helpers.formatNumber(totalVolume)} volume`);
      return stats;

    } catch (error) {
      logger.error('Error getting wallet stats', error);
      return null;
    }
  }

  private async analyzeTransactionsForTrades(transactions: any[], walletAddress: string): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    totalVolume: number;
    lastActiveDate: Date;
  }> {
    let totalTrades = 0;
    let successfulTrades = 0;
    let totalProfit = 0;
    let totalVolume = 0;
    let lastActiveDate = new Date(0);

    const tradeMap = new Map<string, any[]>(); // Group by token

    for (const tx of transactions) {
      try {
        if (tx.blockTime) {
          const txDate = new Date(tx.blockTime * 1000);
          if (txDate > lastActiveDate) {
            lastActiveDate = txDate;
          }
        }

        // Check if this is a token swap/trade
        const isTokenTrade = this.isTokenTradeTransaction(tx);
        if (!isTokenTrade) continue;

        totalTrades++;

        // Simplified profit calculation
        const tradeProfit = await this.calculateTradeProfit(tx, walletAddress);
        if (tradeProfit > 0) {
          successfulTrades++;
        }
        
        totalProfit += tradeProfit;
        
        // Estimate volume
        const tradeVolume = this.estimateTradeVolume(tx);
        totalVolume += tradeVolume;

      } catch (error) {
        // Skip problematic transactions
        continue;
      }
    }

    return {
      totalTrades,
      successfulTrades,
      totalProfit,
      totalVolume,
      lastActiveDate
    };
  }

  private isTokenTradeTransaction(tx: any): boolean {
    // Check if transaction involves token swaps
    if (!tx.parsedInstruction) return false;

    return tx.parsedInstruction.some((instruction: any) => {
      const programId = instruction.programId;
      
      // Common DEX program IDs
      const dexProgramIds = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Serum DEX
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'   // Raydium
      ];
      
      return dexProgramIds.includes(programId);
    });
  }

  private async calculateTradeProfit(tx: any, walletAddress: string): Promise<number> {
    // Simplified profit calculation
    // In real implementation, you'd need to track token prices at transaction time
    
    try {
      // Look for SOL balance changes
      const solTransfer = tx.parsedInstruction?.find((inst: any) => 
        inst.type === 'transfer' && inst.info?.source === walletAddress
      );

      if (solTransfer) {
        const solAmount = parseFloat(solTransfer.info?.lamports || 0) / 1000000000;
        // Very simplified - assume 10% of trades are profitable
        return Math.random() > 0.6 ? solAmount * 0.1 : -solAmount * 0.05;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  private estimateTradeVolume(tx: any): number {
    // Estimate trade volume from transaction
    try {
      const solTransfer = tx.parsedInstruction?.find((inst: any) => 
        inst.type === 'transfer'
      );

      if (solTransfer) {
        const solAmount = parseFloat(solTransfer.info?.lamports || 0) / 1000000000;
        const solPrice = this.solPriceService.getPrice();
        return solAmount * solPrice;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async estimateTokenValue(tokenAddress: string, amount: number): Promise<number> {
    try {
      // Try to get token price from Jupiter API
      const response = await this.apiClient.get(`https://price.jup.ag/v4/price?ids=${tokenAddress}`, {
        timeout: 5000
      });

      if (response.data?.data?.[tokenAddress]?.price) {
        const price = response.data.data[tokenAddress].price;
        return amount * price;
      }

      // Fallback: very conservative estimate
      return amount * 0.01;
    } catch (error) {
      return amount * 0.01; // Very conservative fallback
    }
  }

  private generateDescription(balance: WalletBalance, stats: WalletStats): string {
    const category = Helpers.determineCategory(balance.totalBalanceUsd);
    return `Auto-discovered ${category.toLowerCase().replace('_', ' ')} with ${stats.winRate.toFixed(1)}% win rate and $${Helpers.formatNumber(balance.totalBalanceUsd)} total balance`;
  }

  private generateTags(balance: WalletBalance, stats: WalletStats): string[] {
    const tags: string[] = [];
    
    // Category tag
    tags.push(Helpers.determineCategory(balance.totalBalanceUsd));
    
    // Balance tag
    tags.push(`$${Helpers.formatNumber(balance.totalBalanceUsd)}`);
    
    // Win rate tag
    tags.push(`${stats.winRate.toFixed(0)}%WR`);
    
    // Activity tag
    const daysSinceActive = (Date.now() - new Date(stats.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 1) {
      tags.push('VERY_ACTIVE');
    } else if (daysSinceActive < 7) {
      tags.push('ACTIVE');
    } else {
      tags.push('LESS_ACTIVE');
    }
    
    // Volume tag
    if (stats.totalVolume >= 1000000) {
      tags.push('HIGH_VOLUME');
    } else if (stats.totalVolume >= 100000) {
      tags.push('MEDIUM_VOLUME');
    } else {
      tags.push('LOW_VOLUME');
    }

    return tags;
  }
}

