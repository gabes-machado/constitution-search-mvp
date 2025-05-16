// src/app.controller.ts
import { Controller, Get, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { RawConstitutionDataItem } from './constitution/dto/constitution-data.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiAcceptedResponse, ApiOkResponse } from '@nestjs/swagger'; // Import Swagger decorators

@ApiTags('constitution') // Matches the tag in DocumentBuilder
@Controller('constitution') // Path will be relative to global prefix, e.g., /api/constitution
export class AppController {
  private readonly _logger = new Logger(AppController.name);

  constructor(private readonly _appService: AppService) {}

  @Get('hello')
  @ApiOperation({ summary: 'Get a simple hello message from the API.' })
  @ApiOkResponse({ description: 'Returns a hello string.', type: String })
  getHello(): string {
    return this._appService.getHello();
  }

  @Post('scrape-and-index')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger the scraping and indexing of the Brazilian Constitution.' })
  @ApiAcceptedResponse({ description: 'Scraping process initiated. Check server logs for details.' })
  async triggerScraping(): Promise<{ message: string }> {
    this._logger.log('POST /constitution/scrape-and-index endpoint hit.');
    this._appService.triggerConstitutionScrapingAndIndexing()
      .then(result => this._logger.log(result.message))
      .catch(err => this._logger.error('Async scraping process failed after request.', err.stack));

    return { message: 'Constitution scraping and indexing process has been initiated. Check server logs for progress and completion.' };
  }

  @Get('test-parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test parsing the Constitution HTML without indexing (dry run).' })
  @ApiOkResponse({
    description: 'Dry run parsing completed. Returns item count and a sample of parsed data.',
    // You might want to define a DTO for this response if it becomes complex
    // For now, an example schema can be illustrative
    schema: {
      example: {
        message: 'Constitution parsing dry run completed.',
        itemCount: 150,
        sampleData: [
          { elementType: 'Artigo', text: 'Art. 1º ...', hierarchicalContext: {}, sourceUrl: 'url' },
        ],
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error during parsing test.'})
  async testParsing(): Promise<{ message: string; itemCount: number; sampleData?: RawConstitutionDataItem[] }> {
    this._logger.log('GET /constitution/test-parse endpoint hit.');
    try {
      const parsedData = await this._appService.testConstitutionParsing();
      const sample = parsedData.slice(0, 5);
      return {
        message: 'Constitution parsing dry run completed.',
        itemCount: parsedData.length,
        sampleData: sample,
      };
    } catch (error: any) {
      this._logger.error('Error in test-parse endpoint', error.stack);
      throw new Error(`Parsing test failed: ${error.message}`);
    }
  }
}