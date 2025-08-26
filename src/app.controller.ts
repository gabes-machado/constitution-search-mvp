import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Public } from './auth/decorators/public.decorator';
import { Roles } from './auth/decorators/roles.decorator';
import { AppService } from './app.service';
import { RawConstitutionDataItem } from './constitution/dto/constitution-data.dto';
import { JobsService } from './jobs/jobs.service';

@ApiTags('constitution')
@Controller('constitution')
export class AppController {
  private readonly _logger = new Logger(AppController.name);

  constructor(
    private readonly _appService: AppService,
    private readonly _jobsService: JobsService,
  ) {}

  @Public()
  @Get('hello')
  @ApiOperation({ summary: 'Get a simple hello message from the API.' })
  @ApiResponse({
    status: 200,
    description: 'Returns a hello string.',
    type: String,
  })
  getHello(): string {
    return this._appService.getHello();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('scrape-and-index')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { limit: 2, ttl: 60000 } }) // Only 2 requests per minute for scraping
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger the scraping and indexing of the Brazilian Constitution.',
  })
  @ApiResponse({
    status: 202,
    description: 'Scraping job added to queue successfully.',
    schema: {
      example: {
        message: 'Scraping job added to queue successfully',
        status: 'queued',
        jobId: '1',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async triggerScraping(
    @Query('priority') priority?: number,
    @Query('forceRefresh') forceRefresh?: boolean,
  ): Promise<{ message: string; status: string; jobId?: string }> {
    this._logger.log('POST /constitution/scrape-and-index endpoint hit.');

    try {
      const job = await this._jobsService.addScrapingJob({
        priority,
        forceRefresh,
      });

      return {
        message: 'Scraping job added to queue successfully',
        status: 'queued',
        jobId: job.id?.toString(),
      };
    } catch (error: any) {
      this._logger.error('Failed to add scraping job to queue', error.stack);
      throw new Error(`Failed to queue scraping job: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('test-parse')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 5, ttl: 600000 } }) // 5 requests per 10 minutes for testing
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Test parsing the Constitution HTML without indexing (dry run).',
  })
  @ApiResponse({
    status: 202,
    description:
      'Dry run parsing completed. Returns item count and a sample of parsed data.',
    schema: {
      example: {
        message: 'Constitution parsing dry run completed.',
        itemCount: 150,
        sampleData: [
          {
            elementType: 'Artigo',
            text: 'Art. 1º ...',
            hierarchicalContext: {},
            sourceUrl: 'url',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during parsing test.',
  })
  async testParsing(): Promise<{
    message: string;
    itemCount: number;
    sampleData?: RawConstitutionDataItem[];
  }> {
    this._logger.log('GET /constitution/test-parse endpoint hit.');
    try {
      const parsedData = await this._appService.testConstitutionParsing();
      const sample = parsedData;
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
