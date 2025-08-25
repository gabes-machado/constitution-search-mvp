import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { TypesenseService } from '../typesense/typesense.service';

@Injectable()
export class TypesenseHealthIndicator extends HealthIndicator {
  constructor(private readonly typesenseService: TypesenseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.typesenseService.getCollectionSchema(
        'brazilian_constitution_v1',
      );

      const result = this.getStatus(key, true, {
        message: 'Typesense connection is healthy',
      });

      return result;
    } catch (error: any) {
      const result = this.getStatus(key, false, {
        message: `Typesense connection failed: ${error.message}`,
      });

      throw new HealthCheckError('Typesense check failed', result);
    }
  }
}
