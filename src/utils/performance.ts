// src/utils/performance.ts - PERFORMANCE MONITORING
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private errors: Map<string, number> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private startTime = Date.now();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    
    // Keep only last 1000 values for each metric
    const values = this.metrics.get(name)!;
    if (values.length > 1000) {
      values.shift();
    }
  }

  recordError(errorType: string): void {
    const current = this.errors.get(errorType) || 0;
    this.errors.set(errorType, current + 1);
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  getMetrics(): any {
    const uptime = Date.now() - this.startTime;
    const metrics: any = {
      uptime: {
        milliseconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      cache: {
        hitRate: this.getCacheHitRate(),
        hits: this.cacheHits,
        misses: this.cacheMisses
      },
      errors: Object.fromEntries(this.errors)
    };

    // Calculate averages for numeric metrics
    this.metrics.forEach((values, name) => {
      if (values.length > 0) {
        metrics[name] = {
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          latest: values[values.length - 1]
        };
      }
    });

    return metrics;
  }

  getDetailedMetrics(): any {
    return {
      ...this.getMetrics(),
      raw: Object.fromEntries(this.metrics),
      system: {
        memory: process.memoryUsage(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}