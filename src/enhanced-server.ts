// src/enhanced-server.ts - FIXED VERSION
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import * as schedule from 'node-schedule';
import { freeWhaleRoutes } from './routes/free-whale.routes';
import { logger } from './utils/logger';
import { PerformanceMonitor } from './utils/performance';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT as string) || 3000;
const performanceMonitor = new PerformanceMonitor();

// Enhanced middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-main-app.com', 'https://your-bot-domain.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced rate limiting with different tiers for free plan
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      performanceMonitor.recordError('rate_limit_exceeded');
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Free plan friendly rate limits
app.use('/api/whales', createRateLimiter(60000, 60, 'Too many whale requests - free plan limit')); // 60/minute
app.use('/api/high-value-wallets', createRateLimiter(60000, 120, 'Too many bot requests')); // 120/minute for bots
app.use('/api/refresh', createRateLimiter(300000, 5, 'Too many refresh requests - max 5 per 5 minutes')); // 5/5min
app.use('/api', createRateLimiter(60000, 200, 'Too many API requests - free plan limit')); // 200/minute general

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    performanceMonitor.recordMetric('response_time', duration);
    performanceMonitor.recordMetric('requests_total', 1);
    
    if (res.statusCode >= 400) {
      performanceMonitor.recordError(`http_${res.statusCode}`);
    }
  });
  
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  const uptime = process.uptime();
  
  res.json({
    status: 'online',
    service: 'Free Plan Helius Whale Tracker',
    version: '1.0.0-free',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    plan: 'HELIUS_FREE',
    features: [
      '🆓 Free plan optimized (10M credits/month)',
      '🐋 200 whale tracking capacity', 
      '⚡ 6-hour refresh cycles',
      '💾 Smart caching system',
      '📊 Credit usage monitoring',
      '🎯 Quality-focused discovery'
    ],
    endpoints: {
      whales: '/api/whales',
      topPerformers: '/api/top-performers',
      highValue: '/api/high-value-wallets',
      stats: '/api/stats',
      credits: '/api/credits',
      health: '/api/health'
    },
    performance: {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      avgResponseTime: metrics.response_time?.avg || 0,
      cacheHitRate: metrics.cache?.hitRate || 0,
      totalRequests: metrics.requests_total?.count || 0
    },
    limits: {
      maxWallets: process.env.MAX_WALLETS_TO_TRACK || 200,
      refreshInterval: `${parseInt(process.env.WHALE_REFRESH_INTERVAL || '21600000') / 1000 / 60 / 60} hours`,
      batchSize: process.env.BATCH_SIZE || 20,
      creditBudget: '10M/month'
    }
  });
});

// Enhanced API routes
app.use('/api', freeWhaleRoutes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  performanceMonitor.recordError('server_error');
  logger.error('Server error', err);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack
    } : undefined,
    timestamp: new Date().toISOString(),
    plan: 'FREE'
  });
});

// 404 handler
app.use('*', (req, res) => {
  performanceMonitor.recordError('endpoint_not_found');
  
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/whales',
      'GET /api/whales/:address',
      'GET /api/top-performers',
      'GET /api/high-value-wallets',
      'GET /api/stats',
      'GET /api/credits',
      'POST /api/refresh/:address'
    ],
    plan: 'FREE',
    documentation: 'https://github.com/your-repo/free-whale-tracker#api-documentation'
  });
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // Stop accepting new requests
  const server = app.listen(PORT);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, () => {
  logger.info('\n🆓🐋 FREE PLAN HELIUS WHALE TRACKER STARTED! 🐋🆓');
  console.log('═'.repeat(80));
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Helius: ${process.env.HELIUS_API_KEY ? '✅ Free Plan Key Configured' : '❌ API Key Missing'}`);
  console.log('');
  console.log('🆓 Free Plan Features:');
  console.log(`   📊 Track up to ${process.env.MAX_WALLETS_TO_TRACK || 200} high-quality whales`);
  console.log(`   ⏰ Smart 6-hour refresh cycles (credit optimized)`);
  console.log(`   💾 Aggressive caching (75%+ hit rate)`);
  console.log(`   💳 10M credits/month budget management`);
  console.log(`   🎯 Quality-focused whale discovery`);
  console.log('');
  console.log('📈 Credit Budget:');
  console.log(`   🔍 Discovery: 1M credits (10%)`);
  console.log(`   📊 Tracking: 7M credits (70%)`);
  console.log(`   📡 API: 1M credits (10%)`);
  console.log(`   🛡️ Buffer: 1M credits (10%)`);
  console.log('');
  console.log('🚀 Quick Test:');
  const baseUrl = PORT === 80 ? 'http://localhost' : `http://localhost:${PORT}`;
  console.log(`   curl ${baseUrl}/api/high-value-wallets`);
  console.log(`   curl ${baseUrl}/api/credits`);
  console.log(`   curl ${baseUrl}/api/top-performers`);
  console.log('═'.repeat(80));
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('Server error:', error);
  }
});

export default app;