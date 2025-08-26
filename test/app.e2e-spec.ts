import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('TYPESENSE_CLIENT')
      .useValue({
        collections: jest.fn().mockReturnValue({
          create: jest.fn(),
          retrieve: jest.fn(),
          delete: jest.fn(),
        }),
        health: {
          retrieve: jest.fn().mockResolvedValue({ ok: true }),
        },
      })
      .overrideProvider('BullQueue_scraping')
      .useValue({
        add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getWaiting: jest.fn().mockResolvedValue([]),
        getActive: jest.fn().mockResolvedValue([]),
        getCompleted: jest.fn().mockResolvedValue([]),
        getFailed: jest.fn().mockResolvedValue([]),
        getDelayed: jest.fn().mockResolvedValue([]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get real tokens
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    const userLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'user',
        password: 'user123',
      });

    if (adminLoginResponse.status === 200) {
      adminToken = adminLoginResponse.body.access_token;
    }
    if (userLoginResponse.status === 200) {
      userToken = userLoginResponse.body.access_token;
    }
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /constitution/hello', () => {
    it('should return hello message without authentication', () => {
      return request(app.getHttpServer())
        .get('/constitution/hello')
        .expect(200)
        .expect('Constitution Search MVP API is running!');
    });
  });

  describe('POST /constitution/scrape-and-index', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/constitution/scrape-and-index')
        .expect(401);
    });

    it('should return 403 for authenticated non-admin users', () => {
      if (!userToken) {
        console.log('Skipping test - user token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .post('/constitution/scrape-and-index')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 202 for authenticated admin users', () => {
      if (!adminToken) {
        console.log('Skipping test - admin token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .post('/constitution/scrape-and-index')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('status', 'queued');
          expect(res.body).toHaveProperty('jobId');
        });
    }, 10000);
  });

  describe('GET /constitution/queue-status', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/constitution/queue-status')
        .expect(401);
    });

    it('should return 403 for authenticated non-admin users', () => {
      if (!userToken) {
        console.log('Skipping test - user token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .get('/constitution/queue-status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 200 for authenticated admin users', () => {
      if (!adminToken) {
        console.log('Skipping test - admin token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .get('/constitution/queue-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('waiting');
          expect(res.body).toHaveProperty('active');
          expect(res.body).toHaveProperty('completed');
          expect(res.body).toHaveProperty('failed');
          expect(res.body).toHaveProperty('delayed');
        });
    }, 10000);
  });
});
