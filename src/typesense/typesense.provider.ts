import { Provider, Logger } from '@nestjs/common';
import Typesense from 'typesense';
import { ConfigService } from '@nestjs/config';

export const TYPESENSE_CLIENT = 'TYPESENSE_CLIENT';

/**
 * Factory provider for the Typesense client.
 * It uses the ConfigService to fetch connection parameters from environment variables.
 * It returns a Typesense client instance.
 * It logs the connection parameters and throws an error if any of the required parameters are missing.
 */
export const typesenseClientProvider: Provider = {
  provide: TYPESENSE_CLIENT,
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('TypesenseProvider');

    const host = configService.get<string>('TYPESENSE_HOST');
    const port = configService.get<number>('TYPESENSE_PORT');
    const protocol = configService.get<string>('TYPESENSE_PROTOCOL');
    const apiKey = configService.get<string>('TYPESENSE_API_KEY');
    const path = configService.get<string>('TYPESENSE_PATH', '');

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
          path: path,
        },
      ],
      apiKey,
      connectionTimeoutSeconds: configService.get<number>(
        'TYPESENSE_TIMEOUT_SECONDS',
        50,
      ),
      numRetries: configService.get<number>('TYPESENSE_NUM_RETRIES', 5),
    });
  },
  inject: [ConfigService],
};
