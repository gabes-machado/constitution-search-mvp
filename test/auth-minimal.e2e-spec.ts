import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

describe('AuthController (e2e) - Minimal', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 10000);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should return JWT token for valid admin credentials', () => {
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
          expect(res.body.user.role).toBe('admin');
        });
    });

    it('should return JWT token for valid user credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'user',
          password: 'user123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('expiresIn');
          expect(res.body.user.username).toBe('user');
          expect(res.body.user.role).toBe('user');
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

    it('should return 401 for missing credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(401);
    });
  });

  describe('GET /auth/profile (with authentication)', () => {
    let authToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        });
      
      authToken = loginResponse.body.access_token;
    });

    it('should return user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('username', 'admin');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('role', 'admin');
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
});