import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConstitutionModule } from './constitution/constitution.module';
import { TypesenseModule } from './typesense/typesense.module';
import { HealthModule } from './health/health.module';
import { CacheConfigModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_QUEUE_HOST', 'localhost'),
          port: configService.get<number>('REDIS_QUEUE_PORT', 6379),
          password: configService.get<string>('REDIS_QUEUE_PASSWORD'),
          db: configService.get<number>('REDIS_QUEUE_DB', 1),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
      {
        name: 'medium',
        ttl: 600000, // 10 minutes
        limit: 50, // 50 requests per 10 minutes
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 100, // 100 requests per hour
      },
    ]),
    CacheConfigModule,
    AuthModule,
    TypesenseModule,
    ConstitutionModule,
    HealthModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
