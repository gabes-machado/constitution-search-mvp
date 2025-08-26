import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface ScrapingJobData {
  priority?: number;
  forceRefresh?: boolean;
  timestamp?: Date;
}

@Injectable()
export class JobsService {
  private readonly _logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('scraping') private readonly _scrapingQueue: Queue,
  ) {}

  /**
   * Add a new scraping job to the queue
   * @param data - Job data containing priority and forceRefresh options
   * @returns The added job
   */
  async addScrapingJob(data: ScrapingJobData): Promise<Job> {
    this._logger.log('Adding new scraping job to queue');

    const jobData: ScrapingJobData = {
      ...data,
      timestamp: new Date(),
    };

    const job = await this._scrapingQueue.add('process-constitution', jobData, {
      priority: data.priority || 0,
      delay: 0, // Immediate processing
    });

    this._logger.log(`Scraping job added to queue with ID: ${job.id}`);
    return job;
  }

  /**
   * Get queue statistics
   * @returns Queue job counts and status
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this._scrapingQueue.getWaiting(),
      this._scrapingQueue.getActive(),
      this._scrapingQueue.getCompleted(),
      this._scrapingQueue.getFailed(),
      this._scrapingQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }
}
