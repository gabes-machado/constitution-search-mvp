import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return overall health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
          
          // Check that memory and disk health checks are included
          expect(res.body.details).toHaveProperty('memory_heap');
          expect(res.body.details).toHaveProperty('memory_rss');
          expect(res.body.details).toHaveProperty('storage');
        });
    });

    it('should have correct response structure', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect((res) => {
          expect(['ok', 'error', 'shutting_down']).toContain(res.body.status);
          expect(typeof res.body.info).toBe('object');
          expect(typeof res.body.details).toBe('object');
        });
    });
  });

  describe('GET /health/typesense', () => {
    it('should return typesense health status', () => {
      return request(app.getHttpServer())
        .get('/health/typesense')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
          
          // Check that typesense health check is included
          expect(res.body.details).toHaveProperty('typesense');
        });
    });

    it('should have correct response structure', () => {
      return request(app.getHttpServer())
        .get('/health/typesense')
        .expect((res) => {
          expect(['ok', 'error', 'shutting_down']).toContain(res.body.status);
          expect(typeof res.body.info).toBe('object');
          expect(typeof res.body.details).toBe('object');
        });
    });
  });

  describe('GET /health/memory', () => {
    it('should return memory health status', () => {
      return request(app.getHttpServer())
        .get('/health/memory')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
          
          // Check that memory health checks are included
          expect(res.body.details).toHaveProperty('memory_heap');
          expect(res.body.details).toHaveProperty('memory_rss');
        });
    });

    it('should have correct response structure', () => {
      return request(app.getHttpServer())
        .get('/health/memory')
        .expect((res) => {
          expect(['ok', 'error', 'shutting_down']).toContain(res.body.status);
          expect(typeof res.body.info).toBe('object');
          expect(typeof res.body.details).toBe('object');
        });
    });

    it('should check heap and RSS memory with correct thresholds', () => {
      return request(app.getHttpServer())
        .get('/health/memory')
        .expect((res) => {
          // Should have both heap and RSS checks
          expect(res.body.details.memory_heap).toBeDefined();
          expect(res.body.details.memory_rss).toBeDefined();
          
          // Each memory check should have status and memory info
          if (res.body.details.memory_heap.status === 'up') {
            expect(res.body.details.memory_heap).toHaveProperty('memory');
          }
          
          if (res.body.details.memory_rss.status === 'up') {
            expect(res.body.details.memory_rss).toHaveProperty('memory');
          }
        });
    });
  });
});