import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConstitutionScrapingService } from './constitution/constitution-scraping.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockConstitutionScrapingService = {
      processConstitution: jest.fn().mockResolvedValue(undefined),
      _fetchConstitutionHtml: jest.fn().mockResolvedValue('<html></html>'),
      _parseConstitutionHtml: jest.fn().mockReturnValue([]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConstitutionScrapingService,
          useValue: mockConstitutionScrapingService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the correct message', () => {
      expect(appController.getHello()).toBe(
        'Constitution Search MVP API is running!',
      );
    });
  });
});
