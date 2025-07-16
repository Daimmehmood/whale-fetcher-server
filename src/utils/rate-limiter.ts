// src/utils/rate-limiter.ts - ADVANCED RATE LIMITING
export class RateLimiter {
  private requests: Array<{ timestamp: number; weight: number }> = [];
  private queue: Array<() => void> = [];
  
  constructor(
    private maxRequestsPerSecond: number,
    private burstLimit: number = maxRequestsPerSecond * 5
  ) {}

  async execute<T>(fn: () => Promise<T>, weight: number = 1): Promise<T> {
    await this.waitForSlot(weight);
    this.recordRequest(weight);
    
    try {
      return await fn();
    } catch (error) {
      // Don't count failed requests against rate limit
      this.removeLastRequest();
      throw error;
    }
  }

  private async waitForSlot(weight: number): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        this.cleanupOldRequests();
        
        const currentLoad = this.getCurrentLoad();
        const wouldExceedBurst = currentLoad + weight > this.burstLimit;
        const wouldExceedRate = this.getRequestsInLastSecond() + weight > this.maxRequestsPerSecond;
        
        if (!wouldExceedBurst && !wouldExceedRate) {
          resolve();
        } else {
          // Wait and check again
          setTimeout(checkSlot, 10);
        }
      };
      
      checkSlot();
    });
  }

  private recordRequest(weight: number): void {
    this.requests.push({
      timestamp: Date.now(),
      weight
    });
  }

  private removeLastRequest(): void {
    this.requests.pop();
  }

  private cleanupOldRequests(): void {
    const oneSecondAgo = Date.now() - 1000;
    this.requests = this.requests.filter(req => req.timestamp > oneSecondAgo);
  }

  private getCurrentLoad(): number {
    return this.requests.reduce((sum, req) => sum + req.weight, 0);
  }

  private getRequestsInLastSecond(): number {
    const oneSecondAgo = Date.now() - 1000;
    return this.requests
      .filter(req => req.timestamp > oneSecondAgo)
      .reduce((sum, req) => sum + req.weight, 0);
  }

  getStats(): any {
    return {
      currentLoad: this.getCurrentLoad(),
      requestsLastSecond: this.getRequestsInLastSecond(),
      queueLength: this.queue.length,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      burstLimit: this.burstLimit
    };
  }
}
