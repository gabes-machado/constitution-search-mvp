import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsService } from './jobs/jobs.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

describe('AppController', () => {
  let appController: AppController;
  let mockAppService: jest.Mocked<AppService>;
  let mockJobsService: jest.Mocked<JobsService>;

  beforeEach(async () => {
    // Create mock services
    mockAppService = {
      getHello: jest.fn(),
      testConstitutionParsing: jest.fn(),
      triggerConstitutionScrapingAndIndexing: jest.fn(),
    } as any;

    mockJobsService = {
      addScrapingJob: jest.fn(),
      getQueueStats: jest.fn(),
    } as any;

    // Create mock guards
    const mockJwtAuthGuard = {
      canActivate: jest.fn(() => true),
    };

    const mockRolesGuard = {
      canActivate: jest.fn(() => true),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHello', () => {
    it('should return hello message from AppService', () => {
      const expectedMessage = 'Constitution Search MVP API is running!';
      mockAppService.getHello.mockReturnValue(expectedMessage);

      const result = appController.getHello();

      expect(mockAppService.getHello).toHaveBeenCalled();
      expect(result).toBe(expectedMessage);
    });
  });

  describe('triggerScraping', () => {
    it('should add scraping job to queue successfully', async () => {
      const mockJob = { id: 'test-job-id' };
      mockJobsService.addScrapingJob.mockResolvedValue(mockJob as any);

      const result = await appController.triggerScraping(1, true);

      expect(mockJobsService.addScrapingJob).toHaveBeenCalledWith({
        priority: 1,
        forceRefresh: true,
      });
      expect(result).toEqual({
        message: 'Scraping job added to queue successfully',
        status: 'queued',
        jobId: 'test-job-id',
      });
    });

    it('should handle job service error', async () => {
      const error = new Error('Job service error');
      mockJobsService.addScrapingJob.mockRejectedValue(error);

      await expect(appController.triggerScraping()).rejects.toThrow(
        'Failed to queue scraping job: Job service error',
      );
      expect(mockJobsService.addScrapingJob).toHaveBeenCalledWith({
        priority: undefined,
        forceRefresh: undefined,
      });
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: 2,
        active: 1,
        completed: 10,
        failed: 0,
        delayed: 0,
      };
      mockJobsService.getQueueStats.mockResolvedValue(mockStats);

      const result = await appController.getQueueStatus();

      expect(mockJobsService.getQueueStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('testParsing', () => {
    it('should return parsing test results', async () => {
      const mockParsedData = [
        {
          elementType: 'Artigo' as const,
          text: 'Art. 1º Test article',
          hierarchicalContext: {},
          sourceUrl: 'http://test-url.com',
        },
      ];
      mockAppService.testConstitutionParsing.mockResolvedValue(mockParsedData);

      const result = await appController.testParsing();

      expect(mockAppService.testConstitutionParsing).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Constitution parsing dry run completed.',
        itemCount: 1,
        sampleData: mockParsedData,
      });
    });

    it('should handle parsing service error', async () => {
      const error = new Error('Parsing service error');
      mockAppService.testConstitutionParsing.mockRejectedValue(error);

      await expect(appController.testParsing()).rejects.toThrow(
        'Parsing test failed: Parsing service error',
      );
      expect(mockAppService.testConstitutionParsing).toHaveBeenCalled();
    });
  });
});
