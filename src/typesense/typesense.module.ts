import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypesenseService } from './typesense.service';
import { typesenseClientProvider } from './typesense.provider';

/**
 * Module for Typesense integration.
 * It provides the TypesenseService and the Typesense client factory.
 * Marked as Global to make TypesenseService available throughout the application
 * without needing to import TypesenseModule in every other module.
 */
@Global() // Make this module global
@Module({
  imports: [
    ConfigModule, // Ensures ConfigService is available for the provider
  ],
  providers: [typesenseClientProvider, TypesenseService],
  exports: [TypesenseService, typesenseClientProvider], // Export provider if direct injection of client is needed elsewhere
})
export class TypesenseModule {}