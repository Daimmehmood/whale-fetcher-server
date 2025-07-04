// src/routes/whale.routes.ts
import { Router, Request, Response } from 'express';
import { WhaleDetectionService } from '../services/whaleDetection.service';
import { WhaleDiscoveryService } from '../services/whaleDiscovery.service';
import { SolPriceService } from '../services/solPrice.service';
import { WhaleWallet, FetchResult } from '../types/whale.types';
import { logger } from '../utils/logger';
import { Helpers } from '../utils/helpers';

const router = Router();

// In-memory storage (for simple deployment)
let whaleWallets: WhaleWallet[] = [];
let lastFetchTime: Date | null = null;
let isProcessing: boolean = false;

// Initialize services
const whaleDetection = new WhaleDetectionService();
const whaleDiscovery = new WhaleDiscoveryService();
const solPriceService = SolPriceService.getInstance();

// Configuration
const CONFIG = {
  MIN_BALANCE_USD: parseInt(process.env.MIN_BALANCE_USD || '50000'),
  MIN_WIN_RATE: parseInt(process.env.MIN_WIN_RATE || '50'),
  MIN_TRANSACTIONS: parseInt(process.env.MIN_TRANSACTIONS || '10'),
  MAX_WALLETS_TO_FETCH: parseInt(process.env.MAX_WALLETS_TO_FETCH || '50')
};

// Main whale fetcher function
async function fetchWhales(): Promise<FetchResult> {
  if (isProcessing) {
    return {
      success: false,
      message: 'Fetch already in progress',
      data: {
        newWallets: 0,
        updatedWallets: 0,
        totalWallets: whaleWallets.length,
        highValueWallets: 0,
        fetchTime: 0
      }
    };
  }

  isProcessing = true;
  const startTime = Date.now();
  
  try {
    logger.info('🐋 Starting whale wallet discovery...');
    
    // Update SOL price
    await solPriceService.updatePrice();
    
    // Discover potential wallets
    const potentialWallets = await whaleDiscovery.discoverTopWallets();
    logger.info(`🔍 Found ${potentialWallets.length} potential wallets to analyze`);
    
    let newWallets = 0;
    let updatedWallets = 0;
    const errors: string[] = [];
    
    // Analyze each potential wallet
    for (let i = 0; i < Math.min(potentialWallets.length, CONFIG.MAX_WALLETS_TO_FETCH); i++) {
      const walletAddress = potentialWallets[i];
      
      try {
        // Check if wallet already exists
        const existingIndex = whaleWallets.findIndex(w => w.address === walletAddress);
        
        const whaleData = await whaleDetection.analyzeWalletFromSolscan(walletAddress);
        
        if (whaleData) {
          if (existingIndex >= 0) {
            // Update existing wallet
            whaleWallets[existingIndex] = { 
              ...whaleData, 
              discoveredDate: whaleWallets[existingIndex].discoveredDate 
            };
            updatedWallets++;
          } else {
            // Add new whale
            whaleWallets.push(whaleData);
            newWallets++;
          }
        }
        
        // Add small delay to avoid rate limiting
        await Helpers.sleep(200);
        
      } catch (error) {
        errors.push(`Error analyzing ${walletAddress}: ${error}`);
        logger.error(`❌ Error analyzing ${walletAddress}:`, error);
      }
    }
    
    // Sort wallets by balance
    whaleWallets.sort((a, b) => b.balance.totalBalanceUsd - a.balance.totalBalanceUsd);
    
    const fetchTime = Date.now() - startTime;
    lastFetchTime = new Date();
    
    const highValueWallets = whaleWallets.filter(w => w.balance.totalBalanceUsd >= CONFIG.MIN_BALANCE_USD).length;
    
    logger.success(`Whale fetch completed: ${newWallets} new, ${updatedWallets} updated, ${errors.length} errors`);
    
    return {
      success: true,
      message: `Successfully fetched whale wallets: ${newWallets} new, ${updatedWallets} updated`,
      data: {
        newWallets,
        updatedWallets,
        totalWallets: whaleWallets.length,
        highValueWallets,
        fetchTime
      },
      wallets: whaleWallets,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    logger.error('Whale fetch failed', error);
    return {
      success: false,
      message: `Whale fetch failed: ${error}`,
      data: {
        newWallets: 0,
        updatedWallets: 0,
        totalWallets: whaleWallets.length,
        highValueWallets: 0,
        fetchTime: Date.now() - startTime
      },
      errors: [String(error)]
    };
  } finally {
    isProcessing = false;
  }
}

// 📡 ROUTES

// Get all whale wallets with filtering
router.get('/whales', (req: Request, res: Response): void => {
  const { category, minBalance, minWinRate, limit, riskLevel } = req.query;
  
  let filteredWallets = [...whaleWallets];
  
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

  if (riskLevel) {
    filteredWallets = filteredWallets.filter(w => w.riskLevel === riskLevel);
  }
  
  // Apply limit
  if (limit) {
    filteredWallets = filteredWallets.slice(0, Number(limit));
  }
  
  res.json({
    success: true,
    count: filteredWallets.length,
    totalCount: whaleWallets.length,
    lastUpdated: lastFetchTime?.toISOString() || null,
    filters: { category, minBalance, minWinRate, limit, riskLevel },
    wallets: filteredWallets
  });
});

// Get whale wallet by address
router.get('/whales/:address', (req: Request, res: Response): void => {
  const { address } = req.params;
  
  if (!Helpers.isValidSolanaAddress(address)) {
    res.status(400).json({
      success: false,
      message: 'Invalid Solana wallet address'
    });
    return;
  }
  
  const whale = whaleWallets.find(w => w.address === address);
  
  if (!whale) {
    res.status(404).json({
      success: false,
      message: 'Whale wallet not found'
    });
    return;
  }
  
  res.json({
    success: true,
    whale
  });
});

// Fetch new whales manually
router.post('/fetch', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await fetchWhales();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Fetch failed: ${error}`,
      data: {
        newWallets: 0,
        updatedWallets: 0,
        totalWallets: whaleWallets.length,
        highValueWallets: 0,
        fetchTime: 0
      }
    });
  }
});

// Get high-value wallets (formatted for your main bot)
router.get('/high-value-wallets', (req: Request, res: Response): void => {
  const highValueWallets = whaleWallets
    .filter(w => 
      w.balance.totalBalanceUsd >= CONFIG.MIN_BALANCE_USD && 
      w.stats.winRate >= CONFIG.MIN_WIN_RATE &&
      w.enabled
    )
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
      tags: w.tags
    }));
  
  res.json({
    success: true,
    count: highValueWallets.length,
    lastUpdated: lastFetchTime?.toISOString() || null,
    manualWallets: highValueWallets,
    config: CONFIG
  });
});

// Get statistics
router.get('/stats', (req: Request, res: Response): void => {
  const stats = {
    totalWallets: whaleWallets.length,
    categories: {
      whale: whaleWallets.filter(w => w.category === 'WHALE').length,
      superWhale: whaleWallets.filter(w => w.category === 'SUPER_WHALE').length,
      megaWhale: whaleWallets.filter(w => w.category === 'MEGA_WHALE').length
    },
    riskLevels: {
      low: whaleWallets.filter(w => w.riskLevel === 'LOW').length,
      medium: whaleWallets.filter(w => w.riskLevel === 'MEDIUM').length,
      high: whaleWallets.filter(w => w.riskLevel === 'HIGH').length
    },
    sources: {
      solscan: whaleWallets.filter(w => w.source === 'SOLSCAN').length,
      birdeye: whaleWallets.filter(w => w.source === 'BIRDEYE').length,
      dexscreener: whaleWallets.filter(w => w.source === 'DEXSCREENER').length,
      manual: whaleWallets.filter(w => w.source === 'MANUAL').length
    },
    avgBalance: whaleWallets.length > 0 
      ? whaleWallets.reduce((sum, w) => sum + w.balance.totalBalanceUsd, 0) / whaleWallets.length 
      : 0,
    avgWinRate: whaleWallets.length > 0 
      ? whaleWallets.reduce((sum, w) => sum + w.stats.winRate, 0) / whaleWallets.length 
      : 0,
    topWallets: whaleWallets.slice(0, 5).map(w => ({
      address: w.address.substring(0, 8) + '...',
      name: w.name,
      balance: w.balance.totalBalanceUsd,
      winRate: w.stats.winRate,
      category: w.category
    })),
    lastFetch: lastFetchTime?.toISOString() || null,
    isProcessing,
    config: CONFIG,
    solPrice: solPriceService.getPrice(),
    solPriceAge: solPriceService.getPriceAge()
  };
  
  res.json({
    success: true,
    stats
  });
});

// Analyze specific wallet
router.post('/analyze/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  
  if (!Helpers.isValidSolanaAddress(address)) {
    res.status(400).json({
      success: false,
      message: 'Invalid Solana wallet address'
    });
    return;
  }

  if (isProcessing) {
    res.status(429).json({
      success: false,
      message: 'Analysis already in progress, please try again later'
    });
    return;
  }

  try {
    logger.info(`Manual analysis requested for wallet: ${address}`);
    
    const whaleData = await whaleDetection.analyzeWalletFromSolscan(address);
    
    if (whaleData) {
      // Check if wallet already exists
      const existingIndex = whaleWallets.findIndex(w => w.address === address);
      
      if (existingIndex >= 0) {
        // Update existing wallet
        whaleWallets[existingIndex] = { 
          ...whaleData, 
          discoveredDate: whaleWallets[existingIndex].discoveredDate 
        };
      } else {
        // Add new whale
        whaleWallets.push(whaleData);
      }
      
      res.json({
        success: true,
        message: 'Wallet analyzed successfully',
        whale: whaleData,
        isNewWallet: existingIndex < 0
      });
    } else {
      res.json({
        success: false,
        message: 'Wallet does not meet whale criteria',
        criteria: {
          minBalance: CONFIG.MIN_BALANCE_USD,
          minWinRate: CONFIG.MIN_WIN_RATE,
          minTransactions: CONFIG.MIN_TRANSACTIONS
        }
      });
    }
    
  } catch (error) {
    logger.error(`Error analyzing wallet ${address}`, error);
    res.status(500).json({
      success: false,
      message: `Analysis failed: ${error}`
    });
  }
});

// Get wallet performance summary
router.get('/performance', (req: Request, res: Response): void => {
  const { timeframe = '7d' } = req.query;
  
  // Calculate performance metrics
  const now = new Date();
  let timeframeMs: number;
  
  switch (timeframe) {
    case '24h':
      timeframeMs = 24 * 60 * 60 * 1000;
      break;
    case '7d':
      timeframeMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      timeframeMs = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      timeframeMs = 7 * 24 * 60 * 60 * 1000;
  }
  
  const cutoffDate = new Date(now.getTime() - timeframeMs);
  
  const activeWallets = whaleWallets.filter(w => 
    new Date(w.stats.lastActiveDate) > cutoffDate
  );
  
  const performance = {
    timeframe,
    totalWallets: whaleWallets.length,
    activeWallets: activeWallets.length,
    activePercentage: whaleWallets.length > 0 
      ? (activeWallets.length / whaleWallets.length) * 100 
      : 0,
    averageWinRate: activeWallets.length > 0
      ? activeWallets.reduce((sum, w) => sum + w.stats.winRate, 0) / activeWallets.length
      : 0,
    totalValue: activeWallets.reduce((sum, w) => sum + w.balance.totalBalanceUsd, 0),
    topPerformers: activeWallets
      .sort((a, b) => b.stats.winRate - a.stats.winRate)
      .slice(0, 10)
      .map(w => ({
        address: w.address.substring(0, 8) + '...',
        name: w.name,
        winRate: w.stats.winRate,
        balance: w.balance.totalBalanceUsd,
        category: w.category
      }))
  };
  
  res.json({
    success: true,
    performance
  });
});

export { router as whaleRoutes, fetchWhales };

// src/server.ts - MAIN SERVER FILE
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import * as schedule from 'node-schedule';
import { whaleRoutes, fetchWhales } from './routes/whale.routes';
import { SolPriceService } from './services/solPrice.service';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-main-app.com'] // Replace with your main app domain
    : ['http://localhost:3000', 'http://localhost:3001']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Initialize SOL price service
const solPriceService = SolPriceService.getInstance();

// 📡 ROUTES

// Health check
app.get('/', (req, res) => {
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  
  res.json({
    status: 'online',
    service: 'Whale Wallet Fetcher API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    environment: process.env.NODE_ENV || 'development',
    solPrice: solPriceService.getPrice(),
    solPriceAge: solPriceService.getPriceAge(),
    endpoints: {
      whales: '/api/whales',
      fetch: '/api/fetch',
      stats: '/api/stats',
      highValue: '/api/high-value-wallets',
      performance: '/api/performance'
    }
  });
});

// API routes
app.use('/api', whaleRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/whales',
      'GET /api/whales/:address',
      'POST /api/fetch',
      'GET /api/high-value-wallets',
      'GET /api/stats',
      'POST /api/analyze/:address',
      'GET /api/performance'
    ]
  });
});

// Schedule automatic fetches
const scheduleConfig = {
  enabled: process.env.WEEKLY_FETCH_ENABLED === 'true',
  dayOfWeek: parseInt(process.env.WEEKLY_FETCH_DAY || '1'), // Monday
  hour: parseInt(process.env.WEEKLY_FETCH_HOUR || '2'), // 2 AM
  minute: parseInt(process.env.WEEKLY_FETCH_MINUTE || '0') // 00 minutes
};

if (scheduleConfig.enabled) {
  // Weekly fetch - Every Monday at 2 AM
  const cronExpression = `${scheduleConfig.minute} ${scheduleConfig.hour} * * ${scheduleConfig.dayOfWeek}`;
  
  schedule.scheduleJob(cronExpression, async () => {
    logger.info('🕒 Scheduled whale fetch starting...');
    try {
      const result = await fetchWhales();
      logger.success(`Scheduled fetch completed: ${result.data.newWallets} new, ${result.data.updatedWallets} updated`);
    } catch (error) {
      logger.error('Scheduled whale fetch failed', error);
    }
  });

  logger.info(`⏰ Weekly fetch scheduled: Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][scheduleConfig.dayOfWeek]} at ${scheduleConfig.hour}:${scheduleConfig.minute.toString().padStart(2, '0')}`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info('\n🐋🚀 WHALE WALLET FETCHER SERVER STARTED! 🚀🐋');
  console.log('═'.repeat(70));
  console.log(`🌐 Server running on port: ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('📋 Available endpoints:');
  console.log(`   GET  /                        - Health check & info`);
  console.log(`   GET  /api/whales              - Get all whales (with filters)`);
  console.log(`   GET  /api/whales/:address     - Get specific whale`);
  console.log(`   POST /api/fetch               - Fetch new whales`);
  console.log(`   GET  /api/high-value-wallets  - Get wallets for bot`);
  console.log(`   GET  /api/stats               - Get statistics`);
  console.log(`   POST /api/analyze/:address    - Analyze specific wallet`);
  console.log(`   GET  /api/performance         - Get performance metrics`);
  console.log('');
  console.log('⚙️ Configuration:');
  console.log(`   💰 Minimum balance: ${process.env.MIN_BALANCE_USD || '50,000'}`);
  console.log(`   🏆 Minimum win rate: ${process.env.MIN_WIN_RATE || '50'}%`);
  console.log(`   📊 Minimum transactions: ${process.env.MIN_TRANSACTIONS || '10'}`);
  console.log(`   🔢 Max wallets per fetch: ${process.env.MAX_WALLETS_TO_FETCH || '50'}`);
  console.log(`   ⏰ Weekly fetch: ${scheduleConfig.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log('═'.repeat(70));
  
  // Update SOL price on startup
  solPriceService.updatePrice().then(() => {
    logger.success('SOL price service initialized');
  });
});

export default app;