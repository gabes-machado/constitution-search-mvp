import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  let service: JobsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '1' }),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getQueueToken('scraping'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add a scraping job to the queue', async () => {
    const jobData = { priority: 1, forceRefresh: true };
    const result = await service.addScrapingJob(jobData);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-constitution',
      expect.objectContaining(jobData),
      expect.objectContaining({ priority: 1, delay: 0 })
    );
    expect(result.id).toBe('1');
  });

  it('should get queue statistics', async () => {
    const stats = await service.getQueueStats();

    expect(stats).toEqual({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
  });
});