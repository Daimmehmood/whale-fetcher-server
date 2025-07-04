export class Helpers {
  static formatNumber(num: number): string {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  static sanitizeWalletName(address: string): string {
    return `Whale ${address.substring(0, 8)}`;
  }

  static calculateRiskLevel(winRate: number, transactions: number, balance: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (winRate >= 80 && transactions >= 50 && balance >= 500000) {
      return 'LOW';
    } else if (winRate >= 65 && transactions >= 20 && balance >= 100000) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  static determineCategory(balance: number): 'WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' {
    if (balance >= 1000000) {
      return 'MEGA_WHALE';
    } else if (balance >= 500000) {
      return 'SUPER_WHALE';
    } else {
      return 'WHALE';
    }
  }
}