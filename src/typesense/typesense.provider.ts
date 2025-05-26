import { Provider, Logger } from '@nestjs/common'; // Import Logger
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
    const logger = new Logger('TypesenseProvider'); // Logger instance

    const host = configService.get<string>('TYPESENSE_HOST');
    const port = configService.get<number>('TYPESENSE_PORT');
    const protocol = configService.get<string>('TYPESENSE_PROTOCOL');
    const apiKey = configService.get<string>('TYPESENSE_API_KEY');
    const path = configService.get<string>('TYPESENSE_PATH', ''); // Get path, default to empty string

    // Log the actual values being used
    logger.debug(`Initializing Typesense client with:
      Host: ${host}
      Port: ${port}
      Protocol: ${protocol}
      API Key: ${apiKey ? 'SET (hidden for security)' : 'NOT SET'}
      Path: '${path}'`);

    if (!host || !port || !protocol || !apiKey) {
      const errorMessage =
        'Typesense configuration is incomplete. Ensure TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_PROTOCOL, and TYPESENSE_API_KEY are set in .env';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    return new Typesense.Client({
      nodes: [
        {
          host,
          port,
          protocol,
          path: path, // Include path, which defaults to '' if not set from .env
        },
      ],
      apiKey,
      connectionTimeoutSeconds: configService.get<number>(
        'TYPESENSE_TIMEOUT_SECONDS',
        5,
      ),
      numRetries: configService.get<number>('TYPESENSE_NUM_RETRIES', 3),
    });
  },
  inject: [ConfigService],
};
