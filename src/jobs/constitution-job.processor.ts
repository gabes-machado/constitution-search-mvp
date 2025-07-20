import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConstitutionScrapingService } from '../constitution/constitution-scraping.service';
import { CONSTITUTION_QUEUE } from './jobs.module';

export interface ConstitutionJobData {
  requestId: string;
  userId?: string;
  priority?: number;
  options?: {
    forceRefresh?: boolean;
    skipCache?: boolean;
  };
}

export interface ConstitutionJobResult {
  requestId: string;
  success: boolean;
  itemsProcessed?: number;
  duration: number;
  error?: string;
}

@Processor(CONSTITUTION_QUEUE)
export class ConstitutionJobProcessor {
  private readonly logger = new Logger(ConstitutionJobProcessor.name);

  constructor(
    private readonly constitutionScrapingService: ConstitutionScrapingService,
  ) {}

  @Process('scrape-and-index')
  async handleConstitutionScraping(job: Job<ConstitutionJobData>): Promise<ConstitutionJobResult> {
    const startTime = Date.now();
    const { requestId, userId, options } = job.data;

    this.logger.log(`Starting constitution scraping job ${requestId} for user ${userId || 'anonymous'}`);

    try {
      // Update job progress
      await job.progress(10);

      // Process the constitution with optional cache skipping
      if (options?.skipCache) {
        this.logger.log(`Skipping cache for job ${requestId}`);
        // Implementation would involve clearing cache first
      }

      await job.progress(30);

      // Execute the main scraping and indexing process
      await this.constitutionScrapingService.processConstitution();

      await job.progress(90);

      const duration = Date.now() - startTime;
      const result: ConstitutionJobResult = {
        requestId,
        success: true,
        duration,
      };

      await job.progress(100);
      this.logger.log(`Constitution scraping job ${requestId} completed successfully in ${duration}ms`);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: ConstitutionJobResult = {
        requestId,
        success: false,
        duration,
        error: error.message,
      };

      this.logger.error(`Constitution scraping job ${requestId} failed after ${duration}ms: ${error.message}`, error.stack);
      throw error; // Re-throw to mark job as failed
    }
  }

  @Process('parse-test')
  async handleConstitutionParseTest(job: Job<ConstitutionJobData>): Promise<ConstitutionJobResult> {
    const startTime = Date.now();
    const { requestId, userId } = job.data;

    this.logger.log(`Starting constitution parse test job ${requestId} for user ${userId || 'anonymous'}`);

    try {
      await job.progress(20);

      // This would call the test parsing method
      // const result = await this.constitutionScrapingService.testConstitutionParsing();

      await job.progress(80);

      const duration = Date.now() - startTime;
      const result: ConstitutionJobResult = {
        requestId,
        success: true,
        duration,
      };

      await job.progress(100);
      this.logger.log(`Constitution parse test job ${requestId} completed successfully in ${duration}ms`);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: ConstitutionJobResult = {
        requestId,
        success: false,
        duration,
        error: error.message,
      };

      this.logger.error(`Constitution parse test job ${requestId} failed after ${duration}ms: ${error.message}`, error.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<ConstitutionJobData>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name} with data:`, job.data);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ConstitutionJobData>, result: ConstitutionJobResult) {
    this.logger.log(`Job ${job.id} completed successfully:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job<ConstitutionJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed:`, error.message, error.stack);
  }
}
