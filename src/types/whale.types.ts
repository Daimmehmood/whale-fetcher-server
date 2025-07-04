export interface WalletBalance {
  sol: number;
  usdc: number;
  totalTokensUsd: number;
  totalBalanceUsd: number;
}

export interface WalletStats {
  totalTransactions: number;
  successfulTrades: number;
  winRate: number;
  avgProfitLoss: number;
  lastActiveDate: string;
  profitableTrades: number;
  totalVolume: number;
}

export interface WhaleWallet {
  address: string;
  name: string;
  description: string;
  balance: WalletBalance;
  stats: WalletStats;
  winRate: string;
  enabled: boolean;
  discoveredDate: string;
  lastUpdated: string;
  source: 'SOLSCAN' | 'DEXSCREENER' | 'BIRDEYE' | 'MANUAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE';
  tags: string[];
}

export interface FetchResult {
  success: boolean;
  message: string;
  data: {
    newWallets: number;
    updatedWallets: number;
    totalWallets: number;
    highValueWallets: number;
    fetchTime: number;
  };
  wallets?: WhaleWallet[];
  errors?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}