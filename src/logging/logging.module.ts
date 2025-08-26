import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get<string>('LOG_LEVEL', 'info');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');

        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.colorize({ all: true }),
              winston.format.printf(
                ({ timestamp, level, message, context, trace, ...meta }) => {
                  const contextStr = context ? `[${context}] ` : '';
                  const metaStr = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                  const traceStr = trace ? `\n${trace}` : '';
                  return `${timestamp} ${level}: ${contextStr}${message}${metaStr}${traceStr}`;
                },
              ),
            ),
          }),
        ];

        // Add file logging in production
        if (nodeEnv === 'production') {
          transports.push(
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
          );
        }

        return {
          level: logLevel,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
          transports,
          exitOnError: false,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggingModule {}
