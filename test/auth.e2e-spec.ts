import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
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
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
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
    it('should change password for authenticated user', () => {
      return request(app.getHttpServer())
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          oldPassword: 'admin123',
          newPassword: 'newpassword123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success');
        });
    });

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
    it('should create user for admin user', () => {
      return request(app.getHttpServer())
        .post('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          role: 'user',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('username', 'newuser');
          expect(res.body).toHaveProperty('email', 'newuser@example.com');
          expect(res.body).toHaveProperty('role', 'user');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 403 for non-admin user', () => {
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

  describe('PUT /auth/users/:username (Admin only)', () => {
    it('should update user for admin user', () => {
      return request(app.getHttpServer())
        .put('/auth/users/user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'updated@example.com',
          role: 'admin',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', 'updated@example.com');
          expect(res.body).toHaveProperty('role', 'admin');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .put('/auth/users/someuser')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'test@example.com',
        })
        .expect(403);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .put('/auth/users/someuser')
        .send({
          email: 'test@example.com',
        })
        .expect(401);
    });

    it('should return 404 for nonexistent user', () => {
      return request(app.getHttpServer())
        .put('/auth/users/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'test@example.com',
        })
        .expect(404);
    });
  });
});