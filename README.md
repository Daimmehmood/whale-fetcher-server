# README.md
# 🐋 Whale Wallet Fetcher Server

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Automatic whale wallet discovery and fetching API server for Solana blockchain. This server discovers high-value wallets, analyzes their trading performance, and provides a REST API for integration with trading bots.

## 🚀 Features

- 🔍 **Automatic Whale Discovery**: Discovers whale wallets from multiple sources
- 📊 **Performance Analysis**: Calculates win rates, trading volume, and profit metrics
- 🏆 **Smart Filtering**: Filters wallets based on balance, win rate, and activity
- 📡 **RESTful API**: Clean API endpoints for easy integration
- ⏰ **Scheduled Updates**: Automatic weekly wallet discovery and updates
- 🚀 **Production Ready**: Optimized for Render.com deployment
- 💾 **Smart Caching**: Efficient data management and rate limiting
- 📈 **Real-time SOL Price**: Live SOL price updates for accurate calculations

## 📋 Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/your-username/whale-fetcher-server.git
cd whale-fetcher-server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit environment variables
nano .env
```

## ⚙️ Configuration

Edit the `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Whale Detection Configuration
MIN_BALANCE_USD=50000        # Minimum $50K balance
MIN_WIN_RATE=50             # Minimum 50% win rate
MIN_TRANSACTIONS=10         # Minimum 10 transactions
MAX_WALLETS_TO_FETCH=50     # Max wallets per fetch

# Schedule Configuration
WEEKLY_FETCH_ENABLED=true   # Enable weekly auto-fetch
WEEKLY_FETCH_DAY=1          # Monday (0=Sunday, 1=Monday, etc.)
WEEKLY_FETCH_HOUR=2         # 2 AM
WEEKLY_FETCH_MINUTE=0       # 00 minutes
```

## 🏃‍♂️ Running the Server

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Clean Build
```bash
npm run clean
npm run build
```

## 📡 API Endpoints

### Health Check
```http
GET /
```
Returns server status and configuration.

### Get All Whales
```http
GET /api/whales?category=WHALE&minBalance=100000&minWinRate=60&limit=20
```
**Query Parameters:**
- `category`: WHALE, SUPER_WHALE, MEGA_WHALE
- `minBalance`: Minimum balance in USD
- `minWinRate`: Minimum win rate percentage
- `limit`: Maximum number of results
- `riskLevel`: LOW, MEDIUM, HIGH

### Get Specific Whale
```http
GET /api/whales/:address
```

### Fetch New Whales
```http
POST /api/fetch
```
Manually trigger whale discovery process.

### Get High-Value Wallets (For Trading Bots)
```http
GET /api/high-value-wallets
```
Returns wallets formatted for trading bot integration.

### Get Statistics
```http
GET /api/stats
```
Returns comprehensive statistics about discovered whales.

### Analyze Specific Wallet
```http
POST /api/analyze/:address
```
Manually analyze a specific wallet address.

### Get Performance Metrics
```http
GET /api/performance?timeframe=7d
```
**Query Parameters:**
- `timeframe`: 24h, 7d, 30d

## 📊 API Response Examples

### High-Value Wallets Response
```json
{
  "success": true,
  "count": 25,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "manualWallets": [
    {
      "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "name": "Whale 7xKXtg2C",
      "description": "Auto-discovered mega whale with 78.5% win rate",
      "winrate": "78.5%",
      "enabled": true,
      "category": "MEGA_WHALE",
      "balanceUsd": 1250000,
      "winRateNum": 78.5,
      "lastActive": "2024-01-15T08:45:00.000Z",
      "riskLevel": "LOW",
      "tags": ["MEGA_WHALE", "$1.3M", "79%WR", "VERY_ACTIVE"]
    }
  ],
  "config": {
    "MIN_BALANCE_USD": 50000,
    "MIN_WIN_RATE": 50,
    "MIN_TRANSACTIONS": 10
  }
}
```

### Statistics Response
```json
{
  "success": true,
  "stats": {
    "totalWallets": 150,
    "categories": {
      "whale": 120,
      "superWhale": 25,
      "megaWhale": 5
    },
    "riskLevels": {
      "low": 45,
      "medium": 80,
      "high": 25
    },
    "avgBalance": 285000,
    "avgWinRate": 67.3,
    "topWallets": [
      {
        "address": "7xKXtg2C...",
        "name": "Whale 7xKXtg2C",
        "balance": 1250000,
        "winRate": 78.5,
        "category": "MEGA_WHALE"
      }
    ],
    "lastFetch": "2024-01-15T10:30:00.000Z",
    "isProcessing": false,
    "solPrice": 98.45,
    "solPriceAge": "2m 15s ago"
  }
}
```

## 🌐 Deployment to Render.com

### 1. Create GitHub Repository
```bash
git init
git add .
git commit -m "Initial commit: Whale Fetcher Server"
git branch -M main
git remote add origin https://github.com/your-username/whale-fetcher-server.git
git push -u origin main
```

### 2. Render.com Setup
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `whale-fetcher-server`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm run build:render`
   - **Start Command**: `npm start`

### 3. Environment Variables on Render
Add these environment variables in Render dashboard:

```env
NODE_ENV=production
MIN_BALANCE_USD=50000
MIN_WIN_RATE=50
MIN_TRANSACTIONS=10
MAX_WALLETS_TO_FETCH=50
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
WEEKLY_FETCH_ENABLED=true
WEEKLY_FETCH_DAY=1
WEEKLY_FETCH_HOUR=2
WEEKLY_FETCH_MINUTE=0
```

### 4. Deploy
Click "Create Web Service" and wait for deployment to complete.

Your server will be available at: `https://your-app-name.onrender.com`

## 🔗 Integration with Main Trading Bot

Add this to your main bot to fetch whale wallets:

```typescript
// fetch-whales.ts
import axios from 'axios';
import * as fs from 'fs';

const WHALE_SERVER_URL = 'https://your-app-name.onrender.com';

interface ServerWallet {
  address: string;
  name: string;
  description: string;
  winrate: string;
  enabled: boolean;
  category: string;
  balanceUsd: number;
  winRateNum: number;
  lastActive: string;
  riskLevel: string;
  tags: string[];
}

async function fetchWhaleWalletsFromServer(): Promise<ServerWallet[]> {
  try {
    console.log('🐋 Fetching whale wallets from server...');
    
    const response = await axios.get(`${WHALE_SERVER_URL}/api/high-value-wallets`, {
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MainTradingBot/1.0'
      }
    });
    
    if (response.data.success) {
      console.log(`✅ Fetched ${response.data.count} whale wallets from server`);
      console.log(`📊 Last updated: ${response.data.lastUpdated}`);
      return response.data.manualWallets;
    }
    
    console.warn('⚠️ Server response not successful');
    return [];
  } catch (error) {
    console.error('❌ Failed to fetch whale wallets from server:', error);
    return [];
  }
}

async function updateMainBotWalletList(): Promise<void> {
  try {
    // Fetch whale wallets from server
    const serverWallets = await fetchWhaleWalletsFromServer();
    
    if (serverWallets.length === 0) {
      console.warn('⚠️ No whale wallets received from server');
      return;
    }
    
    // Load existing manual wallets config
    const configPath = 'manualWallets.json';
    let config: any;
    
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      console.warn('⚠️ Could not load existing config, creating new one');
      config = {
        manualWallets: [],
        settings: {
          minPurchaseUsd: 50,
          checkIntervalSeconds: 10,
          enableQualifiedWallets: false,
          enableManualWallets: true,
          minWhalesForConsensus: 2
        }
      };
    }
    
    // Convert server wallets to manual wallets format
    const convertedWallets = serverWallets.map(wallet => ({
      address: wallet.address,
      name: wallet.name,
      description: wallet.description,
      winrate: wallet.winrate,
      enabled: wallet.enabled && wallet.riskLevel !== 'HIGH', // Disable high-risk wallets
      source: 'SERVER_DISCOVERED',
      category: wallet.category,
      balanceUsd: wallet.balanceUsd,
      lastActive: wallet.lastActive,
      fetchedAt: new Date().toISOString()
    }));
    
    // Remove old server-discovered wallets
    config.manualWallets = config.manualWallets.filter((w: any) => 
      w.source !== 'SERVER_DISCOVERED'
    );
    
    // Add new server wallets
    config.manualWallets.push(...convertedWallets);
    
    // Sort by balance (highest first)
    config.manualWallets.sort((a: any, b: any) => 
      (b.balanceUsd || 0) - (a.balanceUsd || 0)
    );
    
    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`✅ Updated wallet list with ${convertedWallets.length} server wallets`);
    console.log(`📊 Total wallets: ${config.manualWallets.length}`);
    console.log(`🏆 High performers: ${convertedWallets.filter(w => w.enabled).length} enabled`);
    
    // Display top wallets
    console.log('\n🐋 Top 5 Server Wallets:');
    convertedWallets.slice(0, 5).forEach((wallet, index) => {
      console.log(`   ${index + 1}. ${wallet.name} - ${wallet.winrate} WR - ${(wallet.balanceUsd / 1000).toFixed(0)}K - ${wallet.enabled ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to update wallet list:', error);
  }
}

// Export functions
export { fetchWhaleWalletsFromServer, updateMainBotWalletList };

// Auto-update every hour if this file is run directly
if (require.main === module) {
  console.log('🐋 Starting whale wallet updater...');
  
  // Update immediately
  updateMainBotWalletList();
  
  // Update every hour
  setInterval(updateMainBotWalletList, 60 * 60 * 1000);
}
```

## 📈 Usage in Main Bot

Add this to your main bot startup:

```typescript
import { updateMainBotWalletList } from './fetch-whales';

// Update whale wallets on startup
await updateMainBotWalletList();

// Update whale wallets every 6 hours
setInterval(updateMainBotWalletList, 6 * 60 * 60 * 1000);
```

## 🧪 Testing the Server

### Local Testing
```bash
# Start development server
npm run dev

# Test endpoints
curl http://localhost:3000/
curl http://localhost:3000/api/stats
curl -X POST http://localhost:3000/api/fetch
curl http://localhost:3000/api/high-value-wallets
```

### Production Testing
```bash
# Test deployed server
curl https://your-app-name.onrender.com/
curl https://your-app-name.onrender.com/api/stats
```

## 📊 Monitoring & Maintenance

### Health Monitoring
The server provides health check endpoint at `/` that includes:
- Server uptime
- SOL price and age
- Processing status
- Available endpoints

### Logs
Logs are stored in the `logs/` directory:
- `info.log` - General information
- `error.log` - Error messages
- `warn.log` - Warning messages

### Performance Monitoring
- Use `/api/stats` for server statistics
- Use `/api/performance` for wallet performance metrics
- Monitor response times and error rates

## 🔧 Troubleshooting

### Common Issues

1. **Rate Limiting Errors**
   - Increase delays between API calls
   - Check rate limit configuration

2. **Memory Issues**
   - Reduce `MAX_WALLETS_TO_FETCH`
   - Implement data persistence

3. **Network Timeouts**
   - Increase axios timeout values
   - Add retry logic

4. **Invalid Wallet Addresses**
   - Check address validation logic
   - Verify data sources

### Debug Mode
Set `NODE_ENV=development` to enable detailed error messages.

## 🚀 Scaling & Optimization

### Performance Optimizations
- Implement Redis for caching
- Add database persistence
- Use worker processes for heavy computations
- Implement request queuing

### Security Enhancements
- Add API authentication
- Implement request signing
- Add IP whitelisting
- Use HTTPS in production

## 📜 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, email your-email@example.com or create an issue on GitHub.

---

## 📁 Project Structure

```
whale-fetcher-server/
├── src/
│   ├── server.ts              # Main server file
│   ├── types/
│   │   └── whale.types.ts     # Type definitions
│   ├── services/
│   │   ├── solPrice.service.ts      # SOL price management
│   │   ├── whaleDetection.service.ts # Whale analysis
│   │   └── whaleDiscovery.service.ts # Wallet discovery
│   ├── routes/
│   │   └── whale.routes.ts    # API routes
│   └── utils/
│       ├── logger.ts          # Logging utility
│       └── helpers.ts         # Helper functions
├── logs/                      # Log files
├── data/                      # Data storage
├── dist/                      # Compiled JS files
├── .env                       # Environment variables
├── .gitignore                 # Git ignore file
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

Happy whale hunting! 🐋💰