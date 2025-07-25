import { Injectable, Logger } from '@nestjs/common';
import { ConstitutionScrapingService } from './constitution/constitution-scraping.service';
import { RawConstitutionDataItem } from './constitution/dto/constitution-data.dto';

@Injectable()
export class AppService {
  private readonly _logger = new Logger(AppService.name);

  constructor(
    private readonly _constitutionScraper: ConstitutionScrapingService,
  ) {}

  /**
   * Triggers the full scraping and indexing process for the Constitution.
   * @returns A success message or throws an error.
   */
  async triggerConstitutionScrapingAndIndexing(): Promise<{
    message: string;
    itemsProcessed?: number;
  }> {
    this._logger.log(
      'Received request to trigger constitution scraping and indexing.',
    );
    try {
      await this._constitutionScraper.processConstitution();
      return {
        message:
          'Constitution scraping and indexing process initiated successfully. Check logs for details.',
      };
    } catch (error: any) {
      this._logger.error(
        'Error during constitution scraping and indexing trigger.',
        error.stack,
      );
      throw new Error(
        `Failed to trigger constitution scraping: ${error.message}`,
      );
    }
  }

  /**
   * Fetches and parses the Constitution HTML for testing purposes without indexing.
   * @returns The raw parsed data.
   */
  async testConstitutionParsing(): Promise<RawConstitutionDataItem[]> {
    this._logger.log(
      'Received request to test constitution parsing (dry run).',
    );
    try {
      const html = await (
        this._constitutionScraper as any
      )._fetchConstitutionHtml();
      const parsedData = (
        this._constitutionScraper as any
      )._parseConstitutionHtml(html);
      this._logger.log(
        `Dry run parsing complete. Found ${parsedData.length} raw items.`,
      );
      return parsedData;
    } catch (error: any) {
      this._logger.error(
        'Error during constitution parsing dry run.',
        error.stack,
      );
      throw new Error(
        `Failed during constitution parsing dry run: ${error.message}`,
      );
    }
  }

  getHello(): string {
    return 'Constitution Search MVP API is running!';
  }
}
