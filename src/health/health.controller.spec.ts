import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { TypesenseHealthIndicator } from './typesense-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockMemoryHealthIndicator: jest.Mocked<MemoryHealthIndicator>;
  let mockDiskHealthIndicator: jest.Mocked<DiskHealthIndicator>;
  let mockTypesenseHealthIndicator: jest.Mocked<TypesenseHealthIndicator>;

  beforeEach(async () => {
    // Create mock services
    mockHealthCheckService = {
      check: jest.fn(),
    } as any;

    mockMemoryHealthIndicator = {
      checkHeap: jest.fn(),
      checkRSS: jest.fn(),
    } as any;

    mockDiskHealthIndicator = {
      checkStorage: jest.fn(),
    } as any;

    mockTypesenseHealthIndicator = {
      isHealthy: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: DiskHealthIndicator,
          useValue: mockDiskHealthIndicator,
        },
        {
          provide: TypesenseHealthIndicator,
          useValue: mockTypesenseHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should call healthCheckService.check with correct health indicators', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockReturnValue(mockHealthResult as any);

      const result = controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toBe(mockHealthResult);
    });

    it('should call memory and disk health indicators with correct parameters', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockImplementation((checks) => {
        // Execute the check functions to verify they call the correct methods
        checks.forEach((check) => check());
        return mockHealthResult as any;
      });

      controller.check();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        150 * 1024 * 1024,
      );
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        150 * 1024 * 1024,
      );
      expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'storage',
        {
          path: '/',
          thresholdPercent: 0.9,
        },
      );
    });
  });

  describe('checkTypesense', () => {
    it('should call healthCheckService.check with typesense health indicator', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockReturnValue(mockHealthResult as any);

      const result = controller.checkTypesense();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);
      expect(result).toBe(mockHealthResult);
    });

    it('should call typesense health indicator with correct parameters', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockImplementation((checks) => {
        // Execute the check function to verify it calls the correct method
        checks.forEach((check) => check());
        return mockHealthResult as any;
      });

      controller.checkTypesense();

      expect(mockTypesenseHealthIndicator.isHealthy).toHaveBeenCalledWith(
        'typesense',
      );
    });
  });

  describe('checkMemory', () => {
    it('should call healthCheckService.check with memory health indicators', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockReturnValue(mockHealthResult as any);

      const result = controller.checkMemory();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toBe(mockHealthResult);
    });

    it('should call memory health indicators with correct parameters', () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockImplementation((checks) => {
        // Execute the check functions to verify they call the correct methods
        checks.forEach((check) => check());
        return mockHealthResult as any;
      });

      controller.checkMemory();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        200 * 1024 * 1024,
      );
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        200 * 1024 * 1024,
      );
    });
  });
});