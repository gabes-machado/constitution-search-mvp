import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConstitutionScrapingService } from './constitution-scraping.service';
import { TypesenseModule } from '../typesense/typesense.module';

@Module({
  imports: [
    HttpModule.register({ // Configure HttpModule if needed (e.g., timeout)
      timeout: 15000, // 15 seconds timeout
      maxRedirects: 5,
    }),
    TypesenseModule,
  ],
  providers: [ConstitutionScrapingService],
  exports: [ConstitutionScrapingService], // Export if you intend to use this service in other modules
})
export class ConstitutionModule {}