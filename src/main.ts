import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('API_PORT', 3000);
  const apiBasePath = '/api';

  app.setGlobalPrefix(apiBasePath);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Constitution Search MVP API')
    .setDescription('API for scraping and testing the Brazilian Constitution.')
    .setVersion('1.0')
    .addTag('constitution', 'Endpoints related to the Brazilian Constitution')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiBasePath}/docs`, app, document, {
    customSiteTitle: 'Constitution Search API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start listening for requests
  await app.listen(port);

  const appUrl = await app.getUrl();
  logger.log(`Application is running on: ${appUrl}`);
  logger.log(`Swagger UI available at ${appUrl}${apiBasePath}/docs`);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Unhandled error during bootstrap:', err);
  process.exit(1);
});
