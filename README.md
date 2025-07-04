# 🐋 Whale Wallet Fetcher Server

Automatic whale wallet discovery and fetching API server for Solana blockchain.

## Features

- 🔍 Automatic whale wallet discovery
- 📊 Wallet balance and trading statistics analysis
- 🏆 Win rate calculation
- 📡 RESTful API endpoints
- ⏰ Scheduled weekly updates
- 🚀 Optimized for Render.com deployment

## API Endpoints

- `GET /` - Health check
- `GET /api/whales` - Get all whale wallets
- `GET /api/whales/:address` - Get specific whale
- `POST /api/fetch` - Manually trigger fetch
- `GET /api/high-value-wallets` - Get wallets for trading bot
- `GET /api/stats` - Get statistics

## Local Development

```bash
npm install
npm run dev