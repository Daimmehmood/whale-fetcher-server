// src/config/helius.config.ts - HELIUS CONFIGURATION
export interface HeliusConfig {
  apiKey: string;
  rateLimit: {
    requestsPerSecond: number;
    burstLimit: number;
  };
  endpoints: {
    mainnet: string;
    devnet?: string;
  };
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export const createHeliusConfig = (): HeliusConfig => {
  const apiKey = process.env.HELIUS_API_KEY;
  
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is required');
  }

  return {
    apiKey,
    rateLimit: {
      requestsPerSecond: parseInt(process.env.HELIUS_RATE_LIMIT_RPS || '100'),
      burstLimit: parseInt(process.env.HELIUS_BURST_LIMIT || '500')
    },
    endpoints: {
      mainnet: `https://api.helius.xyz/v0`,
      devnet: `https://api.helius.xyz/v0/devnet`
    },
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2
    },
    caching: {
      enabled: process.env.ENABLE_CACHING === 'true',
      ttl: parseInt(process.env.CACHE_TTL || '300000'),
      maxSize: 10000
    }
  };
};
