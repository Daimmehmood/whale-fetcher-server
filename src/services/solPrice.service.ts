// src/services/solPrice.service.ts
import axios from 'axios';
import { logger } from '../utils/logger';

export class SolPriceService {
  private static instance: SolPriceService;
  private price: number = 200;
  private lastUpdate: number = 0;
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes

  private readonly PRICE_ENDPOINTS = [
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
    'https://api.coinbase.com/v2/exchange-rates?currency=SOL'
  ];

  private priceAxios = axios.create({
    timeout: 5000,
    headers: {
      'User-Agent': 'WhaleServerBot/1.0',
      'Accept': 'application/json'
    }
  });

  static getInstance(): SolPriceService {
    if (!SolPriceService.instance) {
      SolPriceService.instance = new SolPriceService();
    }
    return SolPriceService.instance;
  }

  constructor() {
    if (SolPriceService.instance) {
      return SolPriceService.instance;
    }
    
    // Start price updates
    this.startPriceUpdates();
    this.updatePrice();
  }

  private startPriceUpdates(): void {
    setInterval(() => {
      this.updatePrice();
    }, this.updateInterval);
  }

  async updatePrice(): Promise<number> {
    try {
      // Try CoinGecko first
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[0]);
        if (response.data?.solana?.usd) {
          this.price = parseFloat(response.data.solana.usd);
          this.lastUpdate = Date.now();
          logger.info(`SOL Price updated: $${this.price.toFixed(2)} (CoinGecko)`);
          return this.price;
        }
      } catch (error) {
        logger.warn('CoinGecko price fetch failed, trying Binance...');
      }

      // Try Binance
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[1]);
        if (response.data?.price) {
          this.price = parseFloat(response.data.price);
          this.lastUpdate = Date.now();
          logger.info(`SOL Price updated: $${this.price.toFixed(2)} (Binance)`);
          return this.price;
        }
      } catch (error) {
        logger.warn('Binance price fetch failed, trying Coinbase...');
      }

      // Try Coinbase
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[2]);
        if (response.data?.data?.rates?.USD) {
          this.price = 1 / parseFloat(response.data.data.rates.USD);
          this.lastUpdate = Date.now();
          logger.info(`SOL Price updated: $${this.price.toFixed(2)} (Coinbase)`);
          return this.price;
        }
      } catch (error) {
        logger.warn('All price APIs failed, using cached price');
      }

    } catch (error) {
      logger.error('Critical error updating SOL price', error);
    }

    return this.price;
  }

  getPrice(): number {
    // Auto-update if price is older than update interval
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      this.updatePrice();
    }
    return this.price;
  }

  getPriceAge(): string {
    const age = Date.now() - this.lastUpdate;
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);

    if (minutes === 0) return `${seconds}s ago`;
    return `${minutes}m ${seconds}s ago`;
  }

  isStale(): boolean {
    return Date.now() - this.lastUpdate > this.updateInterval * 2;
  }
}
