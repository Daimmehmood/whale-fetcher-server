// src/services/whaleDiscovery.service.ts
import axios from 'axios';
import { logger } from '../utils/logger';
import { Helpers } from '../utils/helpers';

export class WhaleDiscoveryService {
  private apiClient = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': 'WhaleDiscoveryBot/1.0',
      'Accept': 'application/json'
    }
  });

  private readonly CONFIG = {
    MAX_WALLETS_PER_SOURCE: parseInt(process.env.MAX_WALLETS_TO_FETCH || '50'),
    MIN_HOLDER_AMOUNT: 1000 // Minimum tokens to be considered significant holder
  };

  async discoverTopWallets(): Promise<string[]> {
    const potentialWallets: string[] = [];

    try {
      logger.info('Starting whale wallet discovery...');

      // Method 1: Get top token holders from popular tokens
      const popularTokens = await this.getPopularTokens();
      for (const tokenMint of popularTokens) {
        const holders = await this.getTopTokenHolders(tokenMint);
        potentialWallets.push(...holders);
        
        // Add delay to avoid rate limiting
        await Helpers.sleep(500);
      }

      // Method 2: Get wallets from recent high-value transactions
      const highValueTxWallets = await this.getWalletsFromHighValueTransactions();
      potentialWallets.push(...highValueTxWallets);

      // Method 3: Get top DeFi protocol users
      const defiWallets = await this.getTopDeFiUsers();
      potentialWallets.push(...defiWallets);

      // Remove duplicates and filter invalid addresses
      const uniqueWallets = [...new Set(potentialWallets)]
        .filter(wallet => Helpers.isValidSolanaAddress(wallet))
        .slice(0, this.CONFIG.MAX_WALLETS_PER_SOURCE);

      logger.success(`Discovered ${uniqueWallets.length} potential whale wallets`);
      return uniqueWallets;

    } catch (error) {
      logger.error('Error discovering wallets', error);
      return [];
    }
  }

  private async getPopularTokens(): Promise<string[]> {
    // Return list of popular Solana tokens
    return [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'So11111111111111111111111111111111111111112',   // WSOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',   // BONK
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',    // JUP
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',    // mSOL
      'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',    // RND
      'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',    // HNT
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj'     // stSOL
    ];
  }

private async getTopTokenHolders(tokenMint: string): Promise<string[]> {
  try {
    const response = await this.apiClient.get(`https://api.solscan.io/token/holders?address=${tokenMint}`);
    
    if (response.data?.data) {
      const holders = response.data.data
        .filter((holder: any) => parseFloat(holder.amount || '0') > this.CONFIG.MIN_HOLDER_AMOUNT)
        .map((holder: any) => holder.address)
        .slice(0, 50);
      
      return holders;
    }
    return [];
  } catch (error) {
    logger.error('Error getting token holders', error);
    return [];
    }
  }

  private async getWalletsFromHighValueTransactions(): Promise<string[]> {
    try {
      logger.info('Getting wallets from high-value transactions...');
      
      const response = await this.apiClient.get('https://public-api.solscan.io/transaction/latest?limit=200');
      
      if (response.data?.data) {
        const wallets = new Set<string>();
        
        for (const tx of response.data.data) {
          try {
            // Look for transactions with significant SOL transfers
            if (tx.parsedInstruction) {
              for (const instruction of tx.parsedInstruction) {
                if (instruction.type === 'transfer' && instruction.info?.lamports) {
                  const solAmount = parseFloat(instruction.info.lamports) / 1000000000;
                  
                  // Only consider transactions > 10 SOL
                  if (solAmount > 10) {
                    const source = instruction.info.source;
                    const destination = instruction.info.destination;
                    
                    if (Helpers.isValidSolanaAddress(source)) {
                      wallets.add(source);
                    }
                    if (Helpers.isValidSolanaAddress(destination)) {
                      wallets.add(destination);
                    }
                  }
                }
              }
            }
            
            // Add transaction signer
            if (tx.signer && Helpers.isValidSolanaAddress(tx.signer)) {
              wallets.add(tx.signer);
            }
          } catch (error) {
            // Skip problematic transactions
            continue;
          }
        }

        const result = Array.from(wallets).slice(0, 100);
        logger.info(`Found ${result.length} wallets from high-value transactions`);
        return result;
      }
      
      return [];
    } catch (error) {
      logger.error('Error getting high-value transactions', error);
      return [];
    }
  }

  private async getTopDeFiUsers(): Promise<string[]> {
    try {
      logger.info('Getting top DeFi protocol users...');
      
      // Get users from popular DeFi protocols
      const defiProtocols = [
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',   // Raydium
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'    // Serum
      ];

      const wallets = new Set<string>();

      for (const protocolId of defiProtocols) {
        try {
          // Get recent transactions involving these programs
          const response = await this.apiClient.get(`https://public-api.solscan.io/transaction/latest?limit=100`);
          
          if (response.data?.data) {
            for (const tx of response.data.data) {
              if (tx.parsedInstruction) {
                const hasProtocolInteraction = tx.parsedInstruction.some((inst: any) => 
                  inst.programId === protocolId
                );
                
                if (hasProtocolInteraction && tx.signer && Helpers.isValidSolanaAddress(tx.signer)) {
                  wallets.add(tx.signer);
                }
              }
            }
          }
          
          await Helpers.sleep(300); // Rate limiting
        } catch (error) {
          logger.warn(`Error getting users for protocol ${protocolId}:`);
          continue;
        }
      }

      const result = Array.from(wallets).slice(0, 50);
      logger.info(`Found ${result.length} DeFi protocol users`);
      return result;
      
    } catch (error) {
      logger.error('Error getting DeFi users', error);
      return [];
    }
  }
}


