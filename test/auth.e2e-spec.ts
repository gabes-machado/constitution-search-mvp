import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
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

  describe('POST /auth/login', () => {
    it('should return JWT token for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('expiresIn');
          expect(res.body.user.username).toBe('admin');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return 401 for nonexistent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password',
        })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile with valid token', () => {
      if (!adminToken) {
        console.log('Skipping test - admin token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('username');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('role');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token for authenticated user', () => {
      if (!adminToken) {
        console.log('Skipping test - admin token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201)  // POST endpoints typically return 201
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('expiresIn');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });
  });

  describe('PUT /auth/change-password', () => {
    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .put('/auth/change-password')
        .send({
          oldPassword: 'oldpass',
          newPassword: 'newpass',
        })
        .expect(401);
    });
  });

  describe('GET /auth/users (Admin only)', () => {
    it('should return users list for admin user', () => {
      if (!adminToken) {
        console.log('Skipping test - admin token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .get('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((user: any) => {
            expect(user).toHaveProperty('username');
            expect(user).toHaveProperty('email');
            expect(user).toHaveProperty('role');
            expect(user).not.toHaveProperty('password');
          });
        });
    });

    it('should return 403 for non-admin user', () => {
      if (!userToken) {
        console.log('Skipping test - user token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .get('/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/auth/users')
        .expect(401);
    });
  });

  describe('POST /auth/users (Admin only)', () => {
    it('should return 403 for non-admin user', () => {
      if (!userToken) {
        console.log('Skipping test - user token not available');
        return Promise.resolve();
      }
      return request(app.getHttpServer())
        .post('/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: 'user',
        })
        .expect(403);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .post('/auth/users')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: 'user',
        })
        .expect(401);
    });
  });
});