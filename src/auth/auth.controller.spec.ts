import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, LoginDto, AuthResponse, User } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockUser: User = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockAdmin: User = {
    id: 'admin-user-id',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock AuthService
    mockAuthService = {
      login: jest.fn(),
      refreshToken: jest.fn(),
      changePassword: jest.fn(),
      getAllUsers: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    } as any;

    // Create mock guards
    const mockJwtAuthGuard = {
      canActivate: jest.fn(() => true),
    };

    const mockRolesGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call AuthService.login with correct arguments', async () => {
      const loginDto: LoginDto = {
        username: 'testuser',
        password: 'testpass',
      };
      const authResponse: AuthResponse = {
        access_token: 'test-token',
        user: mockUser,
        expiresIn: 3600,
      };
      mockAuthService.login.mockResolvedValue(authResponse);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toBe(authResponse);
    });
  });

  describe('getProfile', () => {
    it('should return user from request object', async () => {
      const req = { user: mockUser };

      const result = await controller.getProfile(req);

      expect(result).toBe(mockUser);
    });
  });

  describe('refreshToken', () => {
    it('should call AuthService.refreshToken with user from request', async () => {
      const req = { user: mockUser };
      const tokenResponse = {
        access_token: 'new-token',
        expiresIn: 3600,
      };
      mockAuthService.refreshToken.mockResolvedValue(tokenResponse);

      const result = await controller.refreshToken(req);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(tokenResponse);
    });
  });

  describe('changePassword', () => {
    it('should call AuthService.changePassword with correct arguments', async () => {
      const req = { user: mockUser };
      const body = {
        oldPassword: 'oldpass',
        newPassword: 'newpass',
      };
      mockAuthService.changePassword.mockResolvedValue(true);

      const result = await controller.changePassword(req, body);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockUser.username,
        body.oldPassword,
        body.newPassword,
      );
      expect(result).toEqual({ success: true });
    });

    it('should return success false when password change fails', async () => {
      const req = { user: mockUser };
      const body = {
        oldPassword: 'wrongpass',
        newPassword: 'newpass',
      };
      mockAuthService.changePassword.mockResolvedValue(false);

      const result = await controller.changePassword(req, body);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockUser.username,
        body.oldPassword,
        body.newPassword,
      );
      expect(result).toEqual({ success: false });
    });
  });

  describe('getAllUsers', () => {
    it('should call AuthService.getAllUsers', async () => {
      const users = [mockUser, mockAdmin];
      mockAuthService.getAllUsers.mockResolvedValue(users);

      const result = await controller.getAllUsers();

      expect(mockAuthService.getAllUsers).toHaveBeenCalled();
      expect(result).toBe(users);
    });
  });

  describe('createUser', () => {
    it('should call AuthService.createUser with correct arguments', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password',
        role: 'user' as const,
      };
      const newUser = { ...mockUser, ...userData };
      mockAuthService.createUser.mockResolvedValue(newUser);

      const result = await controller.createUser(userData);

      expect(mockAuthService.createUser).toHaveBeenCalledWith(userData);
      expect(result).toBe(newUser);
    });
  });

  describe('updateUser', () => {
    it('should call AuthService.updateUser with correct arguments', async () => {
      const username = 'testuser';
      const updates = {
        email: 'updated@example.com',
        role: 'admin' as const,
        isActive: false,
      };
      const updatedUser = { ...mockUser, ...updates };
      mockAuthService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(username, updates);

      expect(mockAuthService.updateUser).toHaveBeenCalledWith(username, updates);
      expect(result).toBe(updatedUser);
    });

    it('should handle user not found', async () => {
      const username = 'nonexistent';
      const updates = { email: 'new@example.com' };
      mockAuthService.updateUser.mockResolvedValue(null);

      const result = await controller.updateUser(username, updates);

      expect(mockAuthService.updateUser).toHaveBeenCalledWith(username, updates);
      expect(result).toBeNull();
    });
  });
});