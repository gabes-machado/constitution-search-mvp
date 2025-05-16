// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // Import Swagger modules

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('API_PORT', 3000);
  const apiBasePath = '/api'; // Define a base path for your API, also used for Swagger

  app.setGlobalPrefix(apiBasePath); // Optional: Set a global prefix for all routes

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Swagger (OpenAPI) Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Constitution Search MVP API')
    .setDescription('API for scraping and testing the Brazilian Constitution.')
    .setVersion('1.0')
    .addTag('constitution', 'Endpoints related to the Brazilian Constitution') // Tag for your controller
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // The path for Swagger UI, e.g., http://localhost:3001/api/docs
  SwaggerModule.setup(`${apiBasePath}/docs`, app, document, {
    customSiteTitle: 'Constitution Search API Docs',
    swaggerOptions: {
      persistAuthorization: true, // If you add auth later
      // docExpansion: 'none', // 'list' or 'full'
    },
  });

  logger.log(`Swagger UI available at ${await app.getUrl()}${apiBasePath}/docs`);

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch(err => {
  console.error('[Bootstrap] Unhandled error during bootstrap:', err);
  process.exit(1);
});