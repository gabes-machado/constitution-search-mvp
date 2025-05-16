import { Provider } from '@nestjs/common';
import Typesense from 'typesense';
import { ConfigService } from '@nestjs/config';

export const TYPESENSE_CLIENT = 'TYPESENSE_CLIENT';

/**
 * Factory provider for the Typesense client.
 * It uses the ConfigService to fetch connection parameters from environment variables.
 */
export const typesenseClientProvider: Provider = {
  provide: TYPESENSE_CLIENT,
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('TYPESENSE_HOST');
    const port = configService.get<number>('TYPESENSE_PORT');
    const protocol = configService.get<string>('TYPESENSE_PROTOCOL');
    const apiKey = configService.get<string>('TYPESENSE_API_KEY');

    if (!host || !port || !protocol || !apiKey) {
      throw new Error('Typesense configuration is incomplete. Ensure TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_PROTOCOL, and TYPESENSE_API_KEY are set.');
    }

    return new Typesense.Client({
      nodes: [
        {
          host,
          port,
          protocol,
        },
      ],
      apiKey,
      connectionTimeoutSeconds: configService.get<number>('TYPESENSE_TIMEOUT_SECONDS', 5), // Added a configurable timeout
      numRetries: configService.get<number>('TYPESENSE_NUM_RETRIES', 3), // Added configurable retries
    });
  },
  inject: [ConfigService],
};