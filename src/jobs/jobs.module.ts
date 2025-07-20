import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { ConstitutionJobProcessor } from './constitution-job.processor';
import { JobsService } from './jobs.service';

export const CONSTITUTION_QUEUE = 'constitution-processing';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          lazyConnect: true,
        },
        defaultJobOptions: {
          removeOnComplete: 10, // Keep only 10 completed jobs
          removeOnFail: 50, // Keep 50 failed jobs for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: CONSTITUTION_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  providers: [/* ConstitutionJobProcessor, */ JobsService],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
