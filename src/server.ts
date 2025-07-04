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