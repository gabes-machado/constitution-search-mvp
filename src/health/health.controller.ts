import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { TypesenseHealthIndicator } from './typesense-health.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly memoryHealthIndicator: MemoryHealthIndicator,
    private readonly diskHealthIndicator: DiskHealthIndicator,
    private readonly typesenseHealthIndicator: TypesenseHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overall application health status' })
  @ApiOkResponse({ description: 'Health check results' })
  @HealthCheck()
  check() {
    return this.healthCheckService.check([
      () =>
        this.memoryHealthIndicator.checkHeap('memory_heap', 150 * 1024 * 1024),
      () =>
        this.memoryHealthIndicator.checkRSS('memory_rss', 150 * 1024 * 1024),
      () =>
        this.diskHealthIndicator.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('typesense')
  @ApiOperation({ summary: 'Get Typesense connection health status' })
  @ApiOkResponse({ description: 'Typesense health check results' })
  @HealthCheck()
  checkTypesense() {
    return this.healthCheckService.check([
      () => this.typesenseHealthIndicator.isHealthy('typesense'),
    ]);
  }

  @Get('memory')
  @ApiOperation({ summary: 'Get memory usage health status' })
  @ApiOkResponse({ description: 'Memory health check results' })
  @HealthCheck()
  checkMemory() {
    return this.healthCheckService.check([
      () =>
        this.memoryHealthIndicator.checkHeap('memory_heap', 200 * 1024 * 1024),
      () =>
        this.memoryHealthIndicator.checkRSS('memory_rss', 200 * 1024 * 1024),
    ]);
  }
}
