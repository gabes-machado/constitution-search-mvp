import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConstitutionScrapingService } from './constitution-scraping.service';
import { TypesenseModule } from '../typesense/typesense.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 20000, // 20 seconds timeout
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'pt-BR,en;q=0.9',
      },
    }),
    TypesenseModule,
  ],
  providers: [ConstitutionScrapingService],
  exports: [ConstitutionScrapingService],
})
export class ConstitutionModule {}
