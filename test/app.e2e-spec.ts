import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authService: AuthService;
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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Create test tokens
    const adminPayload = { username: 'admin', sub: 'admin-id', role: 'admin' };
    const userPayload = { username: 'user', sub: 'user-id', role: 'user' };
    
    adminToken = jwtService.sign(adminPayload);
    userToken = jwtService.sign(userPayload);
  });

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
      return request(app.getHttpServer())
        .post('/constitution/scrape-and-index')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 202 for authenticated admin users', () => {
      return request(app.getHttpServer())
        .post('/constitution/scrape-and-index')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('status', 'queued');
          expect(res.body).toHaveProperty('jobId');
        });
    });
  });

  describe('POST /constitution/test-parse', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/constitution/test-parse')
        .expect(401);
    });

    it('should return 403 for authenticated non-admin users', () => {
      return request(app.getHttpServer())
        .post('/constitution/test-parse')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 200 for authenticated admin users', () => {
      return request(app.getHttpServer())
        .post('/constitution/test-parse')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('itemCount');
          expect(res.body).toHaveProperty('sampleData');
        });
    });
  });

  describe('GET /constitution/queue-status', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/constitution/queue-status')
        .expect(401);
    });

    it('should return 403 for authenticated non-admin users', () => {
      return request(app.getHttpServer())
        .get('/constitution/queue-status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 200 for authenticated admin users', () => {
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
    });
  });
});
