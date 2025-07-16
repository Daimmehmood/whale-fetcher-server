// src/routes/free-whale.routes.ts - CORRECTED VERSION WITH PROPER EXPORTS
import { Router, Request, Response } from 'express';
import { HeliusFreeService } from '../services/heliusFreeService';
import { WhaleStorage } from '../utils/storage';
import { WhaleWallet } from '../types/whale.types';
import { logger } from '../utils/logger';
import { Helpers } from '../utils/helpers';

const router = Router();

let heliusService: HeliusFreeService;
const storage = new WhaleStorage();

// Tracked wallets with smart caching
let trackedWallets: Map<string, WhaleWallet> = new Map();
let lastFullUpdate = new Date(0);
let isTracking = false;

// Configuration for free plan
const FREE_PLAN_CONFIG = {
  MAX_WALLETS: parseInt(process.env.MAX_WALLETS_TO_TRACK || '200'),
  REFRESH_INTERVAL: parseInt(process.env.WHALE_REFRESH_INTERVAL || '21600000'), // 6 hours
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '20'),
  MIN_BALANCE: parseInt(process.env.MIN_BALANCE_USD || '25000'),
  MIN_WIN_RATE: parseInt(process.env.MIN_WIN_RATE || '40')
};

// Initialize service
const initializeService = async (): Promise<void> => {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY required for free plan');
  }
  
  heliusService = new HeliusFreeService(apiKey);
  logger.success('🆓 Free plan service initialized');
  
  // Load existing whales to reduce initial API calls
  const savedWhales = storage.loadWhales();
  savedWhales.forEach(whale => {
    trackedWallets.set(whale.address, whale);
  });
  
  logger.info(`📋 Loaded ${trackedWallets.size} cached whales`);
  
  // Start smart tracking
  startSmartTracking();
};

// Smart tracking (credit-conscious)
const startSmartTracking = async (): Promise<void> => {
  if (isTracking) return;
  
  isTracking = true;
  
  const trackingLoop = async (): Promise<void> => {
    try {
      if (!heliusService) {
        logger.warn('Service not initialized, skipping tracking cycle');
        scheduleNextUpdate(60000); // Try again in 1 minute
        return;
      }

      const creditUsage = heliusService.getCreditUsage();
      
      // Check if we have enough credits for full update
      if (creditUsage.remaining < 50000) {
        logger.warn('🚫 Low credits, skipping update');
        scheduleNextUpdate(3600000); // Try again in 1 hour
        return;
      }
      
      logger.info('🔄 Starting smart tracking cycle...');
      const startTime = Date.now();
      
      // Discover new whales only if needed
      let walletAddresses: string[] = [];
      
      if (trackedWallets.size < 150 || shouldRediscover()) {
        logger.info('🔍 Discovering new whales...');
        walletAddresses = await heliusService.discoverWhalesOptimized();
      } else {
        // Use existing tracked wallets
        walletAddresses = Array.from(trackedWallets.keys());
      }
      
      // Track wallets with credit management
      const results = await heliusService.trackWalletsOptimized(walletAddresses);
      
      // Update tracked wallets
      let updatedCount = 0;
      results.forEach((whale, address) => {
        trackedWallets.set(address, whale);
        updatedCount++;
      });
      
      // Save to storage
      storage.saveWhales(Array.from(trackedWallets.values()));
      
      lastFullUpdate = new Date();
      const duration = Date.now() - startTime;
      
      logger.success(`✅ Smart tracking completed: ${updatedCount} wallets updated in ${duration}ms`);
      
      // Log credit usage
      const newCreditUsage = heliusService.getCreditUsage();
      logger.info(`💳 Credits used: ${newCreditUsage.used}, remaining: ${newCreditUsage.remaining}`);
      
      // Schedule next update based on credit availability
      scheduleNextUpdate(calculateOptimalInterval());
      
    } catch (error) {
      logger.error('❌ Smart tracking failed:', error);
      scheduleNextUpdate(1800000); // Try again in 30 minutes
    }
  };
  
  // Start first cycle after delay
  setTimeout(trackingLoop, 5000);
};

const shouldRediscover = (): boolean => {
  const hoursSinceUpdate = (Date.now() - lastFullUpdate.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24; // Rediscover once daily max
};

const calculateOptimalInterval = (): number => {
  if (!heliusService) return FREE_PLAN_CONFIG.REFRESH_INTERVAL;
  
  const creditUsage = heliusService.getCreditUsage();
  const remainingDaily = heliusService.getDailyRemainingCredits();
  
  // If low on daily credits, wait longer
  if (remainingDaily < 50000) {
    return 4 * 60 * 60 * 1000; // 4 hours
  }
  
  // If plenty of credits, update more frequently
  if (remainingDaily > 200000) {
    return 3 * 60 * 60 * 1000; // 3 hours
  }
  
  // Default: 6 hours
  return FREE_PLAN_CONFIG.REFRESH_INTERVAL;
};

const scheduleNextUpdate = (interval: number): void => {
  setTimeout(() => {
    if (isTracking) {
      startSmartTracking();
    }
  }, interval);
};

// ===============================
// CREDIT-CONSCIOUS API ROUTES
// ===============================

// Health check (minimal credits)
router.get('/health', (req: Request, res: Response): void => {
  const creditUsage = heliusService?.getCreditUsage();
  const optimizationStats = heliusService?.getOptimizationStats();
  
  res.json({
    status: 'online',
    service: 'Helius Free Plan Whale Tracker',
    version: '1.0.0-free',
    timestamp: new Date().toISOString(),
    tracking: {
      isActive: isTracking,
      walletsTracked: trackedWallets.size,
      lastUpdate: lastFullUpdate.toISOString(),
      nextUpdate: new Date(Date.now() + calculateOptimalInterval()).toISOString()
    },
    credits: creditUsage ? {
      used: creditUsage.used,
      remaining: creditUsage.remaining,
      dailyUsed: creditUsage.dailyUsed,
      dailyRemaining: heliusService?.getDailyRemainingCredits() || 0,
      resetDate: creditUsage.resetDate
    } : null,
    optimization: optimizationStats,
    plan: 'FREE',
    config: FREE_PLAN_CONFIG
  });
});

// Get whales (cached responses)
router.get('/whales', (req: Request, res: Response): void => {
  const { category, minBalance, minWinRate, limit, sortBy = 'balance' } = req.query;
  
  let filteredWallets = Array.from(trackedWallets.values());
  
  // Apply filters
  if (category) {
    filteredWallets = filteredWallets.filter(w => w.category === category);
  }
  
  if (minBalance) {
    filteredWallets = filteredWallets.filter(w => w.balance.totalBalanceUsd >= Number(minBalance));
  }
  
  if (minWinRate) {
    filteredWallets = filteredWallets.filter(w => w.stats.winRate >= Number(minWinRate));
  }
  
  // Sort wallets
  switch (sortBy) {
    case 'balance':
      filteredWallets.sort((a, b) => b.balance.totalBalanceUsd - a.balance.totalBalanceUsd);
      break;
    case 'winRate':
      filteredWallets.sort((a, b) => b.stats.winRate - a.stats.winRate);
      break;
    case 'activity':
      filteredWallets.sort((a, b) => 
        new Date(b.stats.lastActiveDate).getTime() - new Date(a.stats.lastActiveDate).getTime()
      );
      break;
  }
  
  // Apply limit
  if (limit) {
    filteredWallets = filteredWallets.slice(0, Number(limit));
  }
  
  res.json({
    success: true,
    count: filteredWallets.length,
    totalCount: trackedWallets.size,
    lastUpdated: lastFullUpdate.toISOString(),
    filters: { category, minBalance, minWinRate, limit, sortBy },
    wallets: filteredWallets,
    plan: 'FREE',
    credits: heliusService?.getCreditUsage(),
    cacheInfo: {
      cached: true,
      age: Date.now() - lastFullUpdate.getTime()
    }
  });
});

// Get top performers (cached)
router.get('/top-performers', (req: Request, res: Response): void => {
  const topPerformers = Array.from(trackedWallets.values())
    .filter(w => w.stats.winRate >= 60 && w.balance.totalBalanceUsd >= 50000)
    .sort((a, b) => b.stats.winRate - a.stats.winRate)
    .slice(0, 30) // Reduced for free plan
    .map(w => ({
      address: w.address,
      name: w.name,
      winRate: w.stats.winRate,
      balance: w.balance.totalBalanceUsd,
      category: w.category,
      riskLevel: w.riskLevel,
      lastActive: w.stats.lastActiveDate,
      tags: w.tags
    }));
  
  res.json({
    success: true,
    count: topPerformers.length,
    lastUpdated: lastFullUpdate.toISOString(),
    performers: topPerformers,
    plan: 'FREE',
    credits: heliusService?.getCreditUsage()
  });
});

// High-value wallets for bot (optimized for free plan)
router.get('/high-value-wallets', (req: Request, res: Response): void => {
  const highValueWallets = Array.from(trackedWallets.values())
    .filter(w => 
      w.balance.totalBalanceUsd >= FREE_PLAN_CONFIG.MIN_BALANCE && 
      w.stats.winRate >= FREE_PLAN_CONFIG.MIN_WIN_RATE &&
      w.enabled
    )
    .sort((a, b) => b.balance.totalBalanceUsd - a.balance.totalBalanceUsd)
    .slice(0, 100) // Limit for free plan
    .map(w => ({
      address: w.address,
      name: w.name,
      description: w.description,
      winrate: w.winRate,
      enabled: w.enabled,
      category: w.category,
      balanceUsd: w.balance.totalBalanceUsd,
      winRateNum: w.stats.winRate,
      lastActive: w.stats.lastActiveDate,
      riskLevel: w.riskLevel,
      tags: [...w.tags, 'FREE_PLAN'],
      source: 'HELIUS_FREE'
    }));
  
  res.json({
    success: true,
    count: highValueWallets.length,
    lastUpdated: lastFullUpdate.toISOString(),
    manualWallets: highValueWallets,
    plan: 'FREE',
    credits: heliusService?.getCreditUsage(),
    tracking: {
      totalWallets: trackedWallets.size,
      refreshInterval: calculateOptimalInterval(),
      isActive: isTracking
    },
    config: FREE_PLAN_CONFIG
  });
});

// Manual refresh (credit-aware)
router.post('/refresh/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  
  if (!Helpers.isValidSolanaAddress(address)) {
    res.status(400).json({
      success: false,
      message: 'Invalid Solana wallet address'
    });
    return;
  }
  
  if (!heliusService) {
    res.status(503).json({
      success: false,
      message: 'Service not initialized'
    });
    return;
  }
  
  // Check credits before manual refresh
  const remainingCredits = heliusService.getRemainingCredits();
  if (remainingCredits < 100) {
    res.status(429).json({
      success: false,
      message: 'Insufficient credits for manual refresh',
      credits: {
        remaining: remainingCredits,
        required: 100
      }
    });
    return;
  }

  try {
    const startTime = Date.now();
    const results = await heliusService.trackWalletsOptimized([address]);
    const whale = results.get(address);
    
    if (whale) {
      trackedWallets.set(address, whale);
      
      const duration = Date.now() - startTime;
      
      res.json({
        success: true,
        message: `Wallet refreshed in ${duration}ms`,
        whale,
        credits: heliusService.getCreditUsage()
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Wallet does not meet whale criteria or could not be analyzed',
        criteria: {
          minBalance: FREE_PLAN_CONFIG.MIN_BALANCE,
          minWinRate: FREE_PLAN_CONFIG.MIN_WIN_RATE
        }
      });
    }
    
  } catch (error) {
    logger.error(`Error refreshing wallet ${address}:`, error);
    res.status(500).json({
      success: false,
      message: `Refresh failed: ${error}`
    });
  }
});

// Credit usage stats
router.get('/credits', (req: Request, res: Response): void => {
  if (!heliusService) {
    res.status(503).json({
      success: false,
      message: 'Service not initialized'
    });
    return;
  }
  
  const creditUsage = heliusService.getCreditUsage();
  const optimizationStats = heliusService.getOptimizationStats();
  
  const monthlyUsageRate = creditUsage.used / 10000000;
  const dailyUsageRate = creditUsage.dailyUsed / 333333;
  
  res.json({
    success: true,
    credits: {
      monthly: {
        used: creditUsage.used,
        remaining: creditUsage.remaining,
        total: 10000000,
        usagePercentage: monthlyUsageRate * 100
      },
      daily: {
        used: creditUsage.dailyUsed,
        remaining: heliusService.getDailyRemainingCredits(),
        total: 333333,
        usagePercentage: dailyUsageRate * 100
      },
      resetDate: creditUsage.resetDate
    },
    optimization: optimizationStats,
    recommendations: generateCreditRecommendations(monthlyUsageRate, dailyUsageRate, creditUsage.remaining)
  });
});

// Generate credit usage recommendations
const generateCreditRecommendations = (monthlyRate: number, dailyRate: number, remaining: number): string[] => {
  const recommendations: string[] = [];
  
  if (monthlyRate > 0.8) {
    recommendations.push('⚠️ High monthly usage - consider reducing tracking frequency');
  }
  
  if (dailyRate > 0.7) {
    recommendations.push('🚫 High daily usage - switch to cache-only mode');
  }
  
  if (remaining < 500000) {
    recommendations.push('📉 Low credits remaining - enable conservative mode');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Credit usage is optimal');
  }
  
  return recommendations;
};

// Statistics (cached)
router.get('/stats', (req: Request, res: Response): void => {
  const wallets = Array.from(trackedWallets.values());
  
  const stats = {
    totalWallets: wallets.length,
    categories: {
      whale: wallets.filter(w => w.category === 'WHALE').length,
      superWhale: wallets.filter(w => w.category === 'SUPER_WHALE').length,
      megaWhale: wallets.filter(w => w.category === 'MEGA_WHALE').length
    },
    riskLevels: {
      low: wallets.filter(w => w.riskLevel === 'LOW').length,
      medium: wallets.filter(w => w.riskLevel === 'MEDIUM').length,
      high: wallets.filter(w => w.riskLevel === 'HIGH').length
    },
    performance: {
      avgBalance: wallets.length > 0 
        ? wallets.reduce((sum, w) => sum + w.balance.totalBalanceUsd, 0) / wallets.length 
        : 0,
      avgWinRate: wallets.length > 0 
        ? wallets.reduce((sum, w) => sum + w.stats.winRate, 0) / wallets.length 
        : 0,
      totalValue: wallets.reduce((sum, w) => sum + w.balance.totalBalanceUsd, 0),
      activeToday: wallets.filter(w => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(w.stats.lastActiveDate) > dayAgo;
      }).length
    },
    topWallets: wallets
      .sort((a, b) => b.balance.totalBalanceUsd - a.balance.totalBalanceUsd)
      .slice(0, 10)
      .map(w => ({
        address: w.address.substring(0, 8) + '...',
        name: w.name,
        balance: w.balance.totalBalanceUsd,
        winRate: w.stats.winRate,
        category: w.category
      })),
    tracking: {
      isActive: isTracking,
      lastUpdate: lastFullUpdate.toISOString(),
      nextUpdate: new Date(Date.now() + calculateOptimalInterval()).toISOString()
    },
    plan: 'FREE',
    credits: heliusService?.getCreditUsage(),
    config: FREE_PLAN_CONFIG
  };
  
  res.json({
    success: true,
    stats
  });
});

// Get whale by address (instant lookup)
router.get('/whales/:address', (req: Request, res: Response): void => {
  const { address } = req.params;
  
  if (!Helpers.isValidSolanaAddress(address)) {
    res.status(400).json({
      success: false,
      message: 'Invalid Solana wallet address'
    });
    return;
  }
  
  const whale = trackedWallets.get(address);
  
  if (!whale) {
    res.status(404).json({
      success: false,
      message: 'Whale wallet not found in current tracking set'
    });
    return;
  }
  
  res.json({
    success: true,
    whale,
    lastUpdated: lastFullUpdate.toISOString(),
    plan: 'FREE'
  });
});

// Initialize the service when routes are loaded
initializeService().catch(error => {
  logger.error('Failed to initialize free plan service:', error);
});

export { router as freeWhaleRoutes };