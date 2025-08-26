import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsProcessor } from './jobs.processor';
import { ConstitutionModule } from '../constitution/constitution.module';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'scraping',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_QUEUE_HOST', 'localhost'),
          port: configService.get<number>('REDIS_QUEUE_PORT', 6379),
          password: configService.get<string>('REDIS_QUEUE_PASSWORD'),
          db: configService.get<number>('REDIS_QUEUE_DB', 1),
        },
        defaultJobOptions: {
          attempts: configService.get<number>('JOB_ATTEMPTS', 3),
          backoff: {
            type: 'exponential',
            delay: configService.get<number>('JOB_BACKOFF_DELAY', 5000),
          },
          removeOnComplete: configService.get<number>('JOB_REMOVE_ON_COMPLETE', 10),
          removeOnFail: configService.get<number>('JOB_REMOVE_ON_FAIL', 5),
        },
      }),
      inject: [ConfigService],
    }),
    ConstitutionModule,
  ],
  providers: [JobsService, JobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}