import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConstitutionScrapingService } from '../constitution/constitution-scraping.service';
import { ScrapingJobData } from './jobs.service';

@Processor('scraping')
export class JobsProcessor {
  private readonly _logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly _constitutionScrapingService: ConstitutionScrapingService,
  ) {}

  @Process('process-constitution')
  async handleScrapingJob(job: Job<ScrapingJobData>): Promise<void> {
    const { data } = job;
    const jobId = job.id;

    this._logger.log(
      `Starting scraping job ${jobId} with data:`,
      JSON.stringify(data),
    );

    try {
      // Update job progress
      await job.progress(10);

      // Call the main processing method from ConstitutionScrapingService
      await this._constitutionScrapingService.processConstitution();

      // Update job progress to completion
      await job.progress(100);

      this._logger.log(`Scraping job ${jobId} completed successfully`);
    } catch (error: any) {
      this._logger.error(
        `Scraping job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      // Re-throw the error so Bull can handle retry logic
      throw error;
    }
  }
}
