// src/services/whaleDiscovery.service.ts - ENHANCED SOL-ONLY VERSION
import axios from 'axios';
import { logger } from '../utils/logger';
import { Helpers } from '../utils/helpers';

export class WhaleDiscoveryService {
  private apiClient = axios.create({
    timeout: 25000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  private readonly CONFIG = {
    TARGET_WALLETS: parseInt(process.env.TARGET_WALLETS || '200'), // Target 200 wallets
    MIN_SOL_BALANCE: parseInt(process.env.MIN_SOL_BALANCE || '100'), // Minimum 100 SOL
    MAX_WALLETS_TO_ANALYZE: parseInt(process.env.MAX_WALLETS_TO_ANALYZE || '300'), // Analyze 300, keep best 200
    BATCH_SIZE: parseInt(process.env.DISCOVERY_BATCH_SIZE || '50') // Process in batches
  };

  // Free working RPC endpoints (prioritized by speed)
  private readonly RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
    'https://solana.public-rpc.com',
    'https://api.devnet.solana.com' // Backup
  ];

  // SOL-focused tokens only (highest value holders)
  private readonly SOL_ECOSYSTEM_TOKENS = [
    'So11111111111111111111111111111111111111112',   // Wrapped SOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',    // Marinade SOL
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',    // Jito SOL
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',    // BlazeStake SOL
    '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',    // Lido stSOL
    'LSoLi4A4Pk4i8DPFYcfHziRdEbH9otvSJcSrkMVq99c',     // Liquid staking SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'      // USDC (for SOL traders)
  ];

  // High-value SOL program addresses (whales interact with these)
  private readonly HIGH_VALUE_PROGRAMS = [
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter (biggest DEX)
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Serum DEX
    'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',  // Phoenix DEX
    'CAMMCzo5YL8w4VFF8KVHrK22GGUQpMNRqTNi1Z5qS2QF', // CAMM (automated market maker)
    'CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR',  // Concentrated liquidity
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // Token program (for large holders)
    '11111111111111111111111111111111'                // System program (native SOL)
  ];

  // Known whale addresses (public whales in SOL ecosystem)
  private readonly KNOWN_SOL_WHALES = [
    'GThUX1Atko4tqhN2NaiTazWSeFWMuiUiswQESGMd9BKJ', // Alameda Research wallet
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',  // FTX-related whale
    'EhpADckqRbCNSLqnSmeMnF8PjQiX8jg6JXxrHvQaDSyB', // Jump Trading
    'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq', // Market maker whale
    'HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny', // DeFi whale
    'C5Eav11fGNr8a3FvY8QSj6BTnQ2wEKXAZv6Ap6jLHHQb', // Institutional whale
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS', // Solana Foundation related
    'AxFuniPo3Y7VBn9CeKfEZVr6E8pYJh58wE8dYHLWJXB2'  // Large SOL holder
  ];

  async discoverTopWallets(): Promise<string[]> {
    const allWallets: string[] = [];
    const walletBalances = new Map<string, number>();

    try {
      logger.info(`🎯 Starting ENHANCED SOL whale discovery (Target: ${this.CONFIG.TARGET_WALLETS} wallets)`);

      // Method 1: SOL liquid staking token holders (highest SOL exposure)
      logger.info('🔍 Phase 1: Discovering SOL ecosystem token holders...');
      for (const tokenMint of this.SOL_ECOSYSTEM_TOKENS) {
        const holders = await this.getLargestSOLTokenHolders(tokenMint);
        allWallets.push(...holders);
        logger.info(`Found ${holders.length} holders for ${tokenMint.substring(0, 8)}...`);
        await Helpers.sleep(800); // Rate limiting
      }

      // Method 2: High-value program account discovery
      logger.info('🔍 Phase 2: Scanning high-value DeFi programs...');
      for (const programId of this.HIGH_VALUE_PROGRAMS) {
        const programWallets = await this.getHighValueProgramWallets(programId);
        allWallets.push(...programWallets);
        logger.info(`Found ${programWallets.length} wallets from program ${programId.substring(0, 8)}...`);
        await Helpers.sleep(1000);
      }

      // Method 3: Known whale network discovery
      logger.info('🔍 Phase 3: Expanding from known whale networks...');
      const networkWallets = await this.expandWhaleNetwork();
      allWallets.push(...networkWallets);

      // Method 4: Large SOL balance scanning
      logger.info('🔍 Phase 4: Direct SOL balance scanning...');
      const richSOLWallets = await this.scanForRichSOLWallets();
      allWallets.push(...richSOLWallets);

      // Remove duplicates and validate
      const uniqueWallets = [...new Set(allWallets)]
        .filter(wallet => Helpers.isValidSolanaAddress(wallet));

      logger.info(`🎯 Phase 5: Ranking ${uniqueWallets.length} candidates by SOL balance...`);

      // Batch balance checking for performance
      const qualifiedWallets = await this.rankWalletsByBalance(uniqueWallets);

      logger.success(`💎 Discovered ${qualifiedWallets.length} high-quality SOL whale candidates`);
      return qualifiedWallets.slice(0, this.CONFIG.TARGET_WALLETS);

    } catch (error) {
      logger.error('Error in enhanced whale discovery', error);
      return [];
    }
  }

  private async getLargestSOLTokenHolders(tokenMint: string): Promise<string[]> {
    try {
      for (const rpcUrl of this.RPC_ENDPOINTS) {
        try {
          // Get largest accounts for this SOL-related token
          const response = await this.apiClient.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenLargestAccounts',
            params: [tokenMint]
          });

          if (response.data?.result?.value) {
            const accounts = response.data.result.value;
            const wallets: string[] = [];

            // Get top 50 accounts (increased from 20)
            for (const account of accounts.slice(0, 50)) {
              try {
                const ownerResponse = await this.apiClient.post(rpcUrl, {
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getAccountInfo',
                  params: [
                    account.address,
                    { encoding: 'jsonParsed' }
                  ]
                });

                const accountInfo = ownerResponse.data?.result?.value;
                if (accountInfo?.data?.parsed?.info?.owner) {
                  const owner = accountInfo.data.parsed.info.owner;
                  if (Helpers.isValidSolanaAddress(owner)) {
                    wallets.push(owner);
                  }
                }
              } catch (error) {
                continue;
              }
            }

            return wallets;
          }
        } catch (error) {
          continue;
        }
      }

      return [];
    } catch (error) {
      logger.error(`Error getting SOL token holders for ${tokenMint}`, error);
      return [];
    }
  }

  private async getHighValueProgramWallets(programId: string): Promise<string[]> {
    try {
      for (const rpcUrl of this.RPC_ENDPOINTS) {
        try {
          const response = await this.apiClient.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getProgramAccounts',
            params: [
              programId,
              {
                filters: [],
                encoding: 'base64',
                dataSlice: { offset: 0, length: 0 }
              }
            ]
          });

          if (response.data?.result) {
            const accounts = response.data.result.slice(0, 100); // Increased from 50
            const wallets: string[] = [];
            
            // Process in smaller batches to avoid rate limits
            for (let i = 0; i < accounts.length; i += 10) {
              const batch = accounts.slice(i, i + 10);
              
              for (const account of batch) {
                if (Helpers.isValidSolanaAddress(account.pubkey)) {
                  // Quick balance check - only include if >= minimum SOL
                  const balance = await this.checkSolBalance(account.pubkey, rpcUrl);
                  if (balance >= this.CONFIG.MIN_SOL_BALANCE) {
                    wallets.push(account.pubkey);
                  }
                }
              }
              
              if (i % 50 === 0) { // Rate limiting every 50 accounts
                await Helpers.sleep(500);
              }
            }

            return wallets;
          }
        } catch (error) {
          continue;
        }
      }

      return [];
    } catch (error) {
      logger.error(`Error getting program wallets for ${programId}`, error);
      return [];
    }
  }

  private async expandWhaleNetwork(): Promise<string[]> {
    const networkWallets: string[] = [];
    
    // Add known whales
    networkWallets.push(...this.KNOWN_SOL_WHALES);
    
    // For each known whale, find their recent transaction partners
    for (const whale of this.KNOWN_SOL_WHALES.slice(0, 5)) { // Limit to 5 for performance
      try {
        const partners = await this.findTransactionPartners(whale);
        networkWallets.push(...partners);
        await Helpers.sleep(1000);
      } catch (error) {
        continue;
      }
    }

    return networkWallets;
  }

  private async findTransactionPartners(walletAddress: string): Promise<string[]> {
    try {
      for (const rpcUrl of this.RPC_ENDPOINTS) {
        try {
          const response = await this.apiClient.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
              walletAddress,
              { limit: 50 } // Check recent 50 transactions
            ]
          });

          if (response.data?.result) {
            const signatures = response.data.result;
            const partners: string[] = [];

            // Analyze first 10 transactions for partners
            for (const sig of signatures.slice(0, 10)) {
              try {
                const txResponse = await this.apiClient.post(rpcUrl, {
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getTransaction',
                  params: [
                    sig.signature,
                    { encoding: 'jsonParsed' }
                  ]
                });

                const tx = txResponse.data?.result;
                if (tx?.transaction?.message?.accountKeys) {
                  for (const key of tx.transaction.message.accountKeys) {
                    const address = typeof key === 'string' ? key : key.pubkey;
                    if (Helpers.isValidSolanaAddress(address) && address !== walletAddress) {
                      partners.push(address);
                    }
                  }
                }
              } catch (error) {
                continue;
              }
            }

            return [...new Set(partners)].slice(0, 20); // Return unique partners
          }
        } catch (error) {
          continue;
        }
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  private async scanForRichSOLWallets(): Promise<string[]> {
    // Use a systematic approach to find large SOL holders
    const richWallets: string[] = [];
    
    // Method: Check accounts that hold large amounts of SOL directly
    try {
      for (const rpcUrl of this.RPC_ENDPOINTS) {
        try {
          // Get largest SOL accounts using getTokenLargestAccounts for native SOL
          const response = await this.apiClient.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getLargestAccounts',
            params: [
              {
                filter: 'circulating'
              }
            ]
          });

          if (response.data?.result?.value) {
            const accounts = response.data.result.value;
            
            for (const account of accounts.slice(0, 100)) { // Top 100 accounts
              if (Helpers.isValidSolanaAddress(account.address)) {
                const solBalance = account.lamports / 1000000000;
                if (solBalance >= this.CONFIG.MIN_SOL_BALANCE) {
                  richWallets.push(account.address);
                }
              }
            }

            return richWallets;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      logger.error('Error scanning for rich SOL wallets', error);
    }

    return richWallets;
  }

  private async rankWalletsByBalance(wallets: string[]): Promise<string[]> {
    const walletBalances: Array<{address: string, balance: number}> = [];
    
    // Process wallets in batches for better performance
    for (let i = 0; i < wallets.length; i += this.CONFIG.BATCH_SIZE) {
      const batch = wallets.slice(i, i + this.CONFIG.BATCH_SIZE);
      
      for (const wallet of batch) {
        try {
          const balance = await this.checkSolBalance(wallet);
          if (balance >= this.CONFIG.MIN_SOL_BALANCE) {
            walletBalances.push({ address: wallet, balance });
          }
        } catch (error) {
          continue;
        }
      }
      
      // Progress logging
      if (i % 100 === 0) {
        logger.info(`📊 Processed ${i}/${wallets.length} wallets, found ${walletBalances.length} qualified`);
        await Helpers.sleep(1000); // Rate limiting
      }
    }

    // Sort by balance (highest first) and return top addresses
    return walletBalances
      .sort((a, b) => b.balance - a.balance)
      .slice(0, this.CONFIG.TARGET_WALLETS)
      .map(w => w.address);
  }

  private async checkSolBalance(address: string, preferredRpc?: string): Promise<number> {
    const rpcsToTry = preferredRpc ? [preferredRpc, ...this.RPC_ENDPOINTS] : this.RPC_ENDPOINTS;
    
    for (const rpcUrl of rpcsToTry) {
      try {
        const response = await this.apiClient.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address]
        });

        if (response.data?.result?.value) {
          return response.data.result.value / 1000000000; // Convert lamports to SOL
        }
      } catch (error) {
        continue;
      }
    }
    
    return 0;
  }
}