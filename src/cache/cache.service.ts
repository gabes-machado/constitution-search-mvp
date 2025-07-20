import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly _logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly _cacheManager: Cache) {}

  /**
   * Get cached HTML content
   */
  async getHtmlContent(url: string): Promise<string | null> {
    try {
      const cacheKey = `html_content:${this._generateCacheKey(url)}`;
      const cachedContent = await this._cacheManager.get<string>(cacheKey);
      
      if (cachedContent) {
        this._logger.log(`Cache HIT for URL: ${url}`);
        return cachedContent;
      }
      
      this._logger.log(`Cache MISS for URL: ${url}`);
      return null;
    } catch (error: any) {
      this._logger.error(`Cache get error for URL ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache HTML content
   */
  async setHtmlContent(url: string, content: string, ttl?: number): Promise<void> {
    try {
      const cacheKey = `html_content:${this._generateCacheKey(url)}`;
      await this._cacheManager.set(cacheKey, content, ttl);
      this._logger.log(`Cached HTML content for URL: ${url}`);
    } catch (error: any) {
      this._logger.error(`Cache set error for URL ${url}: ${error.message}`);
    }
  }

  /**
   * Get cached parsed data
   */
  async getParsedData(url: string): Promise<any[] | null> {
    try {
      const cacheKey = `parsed_data:${this._generateCacheKey(url)}`;
      const cachedData = await this._cacheManager.get<any[]>(cacheKey);
      
      if (cachedData) {
        this._logger.log(`Cache HIT for parsed data: ${url}`);
        return cachedData;
      }
      
      this._logger.log(`Cache MISS for parsed data: ${url}`);
      return null;
    } catch (error: any) {
      this._logger.error(`Cache get error for parsed data ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache parsed data
   */
  async setParsedData(url: string, data: any[], ttl?: number): Promise<void> {
    try {
      const cacheKey = `parsed_data:${this._generateCacheKey(url)}`;
      await this._cacheManager.set(cacheKey, data, ttl);
      this._logger.log(`Cached parsed data for URL: ${url}`);
    } catch (error: any) {
      this._logger.error(`Cache set error for parsed data ${url}: ${error.message}`);
    }
  }

  /**
   * Clear cache for a specific URL
   */
  async clearCache(url: string): Promise<void> {
    try {
      const htmlCacheKey = `html_content:${this._generateCacheKey(url)}`;
      const parsedCacheKey = `parsed_data:${this._generateCacheKey(url)}`;
      
      await this._cacheManager.del(htmlCacheKey);
      await this._cacheManager.del(parsedCacheKey);
      
      this._logger.log(`Cleared cache for URL: ${url}`);
    } catch (error: any) {
      this._logger.error(`Cache clear error for URL ${url}: ${error.message}`);
    }
  }

  /**
   * Clear all cache (simplified implementation)
   */
  async clearAllCache(): Promise<void> {
    try {
      // For now, we'll just log that cache clearing was requested
      // In production, you might want to implement pattern-based deletion
      this._logger.log('Cache clear all requested - implement pattern-based deletion if needed');
    } catch (error: any) {
      this._logger.error(`Cache clear all error: ${error.message}`);
    }
  }

  /**
   * Generate a consistent cache key from URL
   */
  private _generateCacheKey(url: string): string {
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
}
