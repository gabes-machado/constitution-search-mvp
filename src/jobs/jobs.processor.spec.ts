import { Test, TestingModule } from '@nestjs/testing';
import { JobsProcessor } from './jobs.processor';
import { ConstitutionScrapingService } from '../constitution/constitution-scraping.service';

describe('JobsProcessor', () => {
  let processor: JobsProcessor;
  let mockConstitutionScrapingService: any;

  beforeEach(async () => {
    mockConstitutionScrapingService = {
      processConstitution: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsProcessor,
        {
          provide: ConstitutionScrapingService,
          useValue: mockConstitutionScrapingService,
        },
      ],
    }).compile();

    processor = module.get<JobsProcessor>(JobsProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should handle scraping job successfully', async () => {
    const mockJob = {
      id: '1',
      data: { priority: 1, forceRefresh: true },
      progress: jest.fn().mockResolvedValue(undefined),
    };

    await processor.handleScrapingJob(mockJob as any);

    expect(mockJob.progress).toHaveBeenCalledWith(10);
    expect(mockConstitutionScrapingService.processConstitution).toHaveBeenCalled();
    expect(mockJob.progress).toHaveBeenCalledWith(100);
  });

  it('should handle job failure and re-throw error', async () => {
    const mockJob = {
      id: '1',
      data: { priority: 1, forceRefresh: true },
      progress: jest.fn().mockResolvedValue(undefined),
    };

    const error = new Error('Test error');
    mockConstitutionScrapingService.processConstitution.mockRejectedValue(error);

    await expect(processor.handleScrapingJob(mockJob as any)).rejects.toThrow('Test error');
    expect(mockJob.progress).toHaveBeenCalledWith(10);
    expect(mockConstitutionScrapingService.processConstitution).toHaveBeenCalled();
  });
});