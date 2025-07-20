import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { ConstitutionJobData, ConstitutionJobResult } from './constitution-job.processor';
import { CONSTITUTION_QUEUE } from './jobs.module';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(CONSTITUTION_QUEUE)
    private readonly constitutionQueue: Queue<ConstitutionJobData>,
  ) {}

  /**
   * Queue a constitution scraping and indexing job
   */
  async queueConstitutionScraping(options?: {
    userId?: string;
    priority?: number;
    forceRefresh?: boolean;
    skipCache?: boolean;
  }): Promise<{ jobId: string; requestId: string }> {
    const requestId = uuidv4();
    const jobData: ConstitutionJobData = {
      requestId,
      userId: options?.userId,
      priority: options?.priority || 0,
      options: {
        forceRefresh: options?.forceRefresh,
        skipCache: options?.skipCache,
      },
    };

    const job = await this.constitutionQueue.add('scrape-and-index', jobData, {
      priority: options?.priority || 0,
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    this.logger.log(`Queued constitution scraping job ${job.id} with request ID ${requestId}`);

    return {
      jobId: job.id.toString(),
      requestId,
    };
  }

  /**
   * Queue a constitution parse test job
   */
  async queueConstitutionParseTest(options?: {
    userId?: string;
    priority?: number;
  }): Promise<{ jobId: string; requestId: string }> {
    const requestId = uuidv4();
    const jobData: ConstitutionJobData = {
      requestId,
      userId: options?.userId,
      priority: options?.priority || 0,
    };

    const job = await this.constitutionQueue.add('parse-test', jobData, {
      priority: options?.priority || 0,
      delay: 0,
      attempts: 2,
    });

    this.logger.log(`Queued constitution parse test job ${job.id} with request ID ${requestId}`);

    return {
      jobId: job.id.toString(),
      requestId,
    };
  }

  /**
   * Get job status by job ID
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    progress: number;
    data: ConstitutionJobData;
    result?: ConstitutionJobResult;
    error?: string;
  } | null> {
    try {
      const job = await this.constitutionQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: job.id.toString(),
        status: state,
        progress: typeof progress === 'number' ? progress : 0,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
      };
    } catch (error: any) {
      this.logger.error(`Error getting job status for ${jobId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const waiting = await this.constitutionQueue.getWaiting();
    const active = await this.constitutionQueue.getActive();
    const completed = await this.constitutionQueue.getCompleted();
    const failed = await this.constitutionQueue.getFailed();
    const delayed = await this.constitutionQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Cancel a job by ID
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.constitutionQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      this.logger.log(`Cancelled job ${jobId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error cancelling job ${jobId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.constitutionQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.retry();
      this.logger.log(`Retried job ${jobId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error retrying job ${jobId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear completed jobs
   */
  async clearCompletedJobs(): Promise<void> {
    await this.constitutionQueue.clean(5000, 'completed');
    this.logger.log('Cleared completed jobs older than 5 seconds');
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs(): Promise<void> {
    await this.constitutionQueue.clean(24 * 60 * 60 * 1000, 'failed'); // 24 hours
    this.logger.log('Cleared failed jobs older than 24 hours');
  }
}
