import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TypesenseHealthIndicator } from './typesense-health.indicator';
import { TypesenseModule } from '../typesense/typesense.module';

@Module({
  imports: [TerminusModule, TypesenseModule],
  controllers: [HealthController],
  providers: [TypesenseHealthIndicator],
})
export class HealthModule {}
