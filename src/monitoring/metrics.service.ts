import { Injectable, Logger } from '@nestjs/common';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // HTTP metrics
  public readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  // Constitution processing metrics
  public readonly constitutionScrapingTotal = new Counter({
    name: 'constitution_scraping_total',
    help: 'Total number of constitution scraping operations',
    labelNames: ['status'],
  });

  public readonly constitutionScrapingDuration = new Histogram({
    name: 'constitution_scraping_duration_seconds',
    help: 'Duration of constitution scraping operations in seconds',
    buckets: [10, 30, 60, 120, 300, 600, 1200],
  });

  public readonly constitutionItemsProcessed = new Counter({
    name: 'constitution_items_processed_total',
    help: 'Total number of constitution items processed',
  });

  // Cache metrics
  public readonly cacheOperationsTotal = new Counter({
    name: 'cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'result'],
  });

  public readonly cacheHitRatio = new Gauge({
    name: 'cache_hit_ratio',
    help: 'Cache hit ratio (0-1)',
  });

  // Typesense metrics
  public readonly typesenseOperationsTotal = new Counter({
    name: 'typesense_operations_total',
    help: 'Total number of Typesense operations',
    labelNames: ['operation', 'status'],
  });

  public readonly typesenseOperationDuration = new Histogram({
    name: 'typesense_operation_duration_seconds',
    help: 'Duration of Typesense operations in seconds',
    labelNames: ['operation'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    this.logger.log('Metrics service initialized');
  }

  /**
   * Get all metrics in Prometheus format.
   * @returns A Promise that resolves to a string containing the metrics in Prometheus format.
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Record HTTP request metrics.
   * @param method - The HTTP method of the request.
   * @param route - The route of the request.
   * @param statusCode - The status code of the response.
   * @param duration - The duration of the request in seconds.
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  /**
   * Record constitution scraping metrics.
   * @param status - The status of the scraping operation.
   * @param duration - The duration of the scraping operation in seconds.
   * @param itemsProcessed - The number of items processed.
   */
  recordConstitutionScraping(
    status: 'success' | 'failure',
    duration: number,
    itemsProcessed?: number,
  ) {
    this.constitutionScrapingTotal.inc({ status });
    this.constitutionScrapingDuration.observe(duration);

    if (itemsProcessed) {
      this.constitutionItemsProcessed.inc(itemsProcessed);
    }
  }

  /**
   * Record cache operation metrics.
   * @param operation - The cache operation.
   * @param result - The result of the cache operation.
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    result: 'hit' | 'miss' | 'success' | 'error',
  ) {
    this.cacheOperationsTotal.inc({ operation, result });
  }

  /**
   * Update cache hit ratio.
   * @param ratio - The cache hit ratio.
   */
  updateCacheHitRatio(ratio: number) {
    this.cacheHitRatio.set(ratio);
  }

  /**
   * Record Typesense operation metrics.
   * @param operation - The Typesense operation.
   * @param status - The status of the operation.
   * @param duration - The duration of the operation in seconds.
   */
  recordTypesenseOperation(
    operation: string,
    status: 'success' | 'error',
    duration: number,
  ) {
    this.typesenseOperationsTotal.inc({ operation, status });
    this.typesenseOperationDuration.observe({ operation }, duration);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics() {
    register.clear();
    this.logger.log('All metrics reset');
  }
}
