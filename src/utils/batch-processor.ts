// src/utils/batch-processor.ts - ULTRA FAST BATCH PROCESSING
export class BatchProcessor<T, R> {
  private queue: Array<{
    items: T[];
    priority: number;
    resolve: (results: R[]) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private processing = false;
  private maxConcurrency: number;
  private batchSize: number;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    options: {
      maxConcurrency?: number;
      batchSize?: number;
    } = {}
  ) {
    this.maxConcurrency = options.maxConcurrency || 10;
    this.batchSize = options.batchSize || 100;
  }

  async process(items: T[], priority: number = 1): Promise<R[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ items, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      
      if (!this.processing) {
        this.startProcessing();
      }
    });
  }

  private async startProcessing(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.shift()!;
      
      try {
        const chunks = this.chunkArray(batch.items, this.batchSize);
        const promises = chunks.map(chunk => this.processor(chunk));
        
        const results = await Promise.all(promises);
        const flattened = results.flat();
        
        batch.resolve(flattened);
      } catch (error) {
        batch.reject(error as Error);
      }
    }
    
    this.processing = false;
  }

  private chunkArray<U>(array: U[], size: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
