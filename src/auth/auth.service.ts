import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: Omit<User, 'password'>;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // In-memory user store for MVP (replace with database in production)
  private readonly users: Map<string, User & { password: string }> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.initializeDefaultUsers();
  }

  /**
   * Initialize default users for MVP
   */
  private async initializeDefaultUsers() {
    const adminPassword = await bcrypt.hash(
      this.configService.get<string>('ADMIN_DEFAULT_PASSWORD', 'admin123'),
      12,
    );

    const userPassword = await bcrypt.hash(
      this.configService.get<string>('USER_DEFAULT_PASSWORD', 'user123'),
      12,
    );

    // Default admin user
    this.users.set('admin', {
      id: 'admin',
      username: 'admin',
      email: 'admin@constitution-search.com',
      password: adminPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    });

    // Default regular user
    this.users.set('user', {
      id: 'user',
      username: 'user',
      email: 'user@constitution-search.com',
      password: userPassword,
      role: 'user',
      isActive: true,
      createdAt: new Date(),
    });

    this.logger.log('Default users initialized');
  }

  /**
   * Validate user credentials
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = this.users.get(username);

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    user.lastLoginAt = new Date();

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login user and return JWT token
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { username, password } = loginDto;

    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const expiresIn = this.configService.get<number>('JWT_EXPIRES_IN', 3600); // 1 hour default
    const access_token = this.jwtService.sign(payload, { expiresIn });

    this.logger.log(`User ${username} logged in successfully`);

    return {
      access_token,
      user,
      expiresIn,
    };
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(payload: JwtPayload): Promise<User | null> {
    const user = this.users.get(payload.username);

    if (!user || !user.isActive) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.id === id && user.isActive) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    return null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const user = this.users.get(username);
    if (!user || !user.isActive) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
  }): Promise<User> {
    const { username, email, password, role } = userData;

    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser: User & { password: string } = {
      id: `user_${Date.now()}`,
      username,
      email,
      password: hashedPassword,
      role,
      isActive: true,
      createdAt: new Date(),
    };

    this.users.set(username, newUser);

    this.logger.log(`New user created: ${username} (${role})`);

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Update user (admin only)
   */
  async updateUser(
    username: string,
    updates: Partial<{
      email: string;
      role: 'admin' | 'user';
      isActive: boolean;
    }>,
  ): Promise<User | null> {
    const user = this.users.get(username);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    this.users.set(username, user);

    this.logger.log(`User updated: ${username}`);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Change user password
   */
  async changePassword(
    username: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = this.users.get(username);
    if (!user) {
      return false;
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return false;
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    this.users.set(username, user);

    this.logger.log(`Password changed for user: ${username}`);
    return true;
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    const users: User[] = [];
    for (const user of this.users.values()) {
      const { password: _, ...userWithoutPassword } = user;
      users.push(userWithoutPassword);
    }
    return users;
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(
    user: User,
  ): Promise<{ access_token: string; expiresIn: number }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const expiresIn = this.configService.get<number>('JWT_EXPIRES_IN', 3600);
    const access_token = this.jwtService.sign(payload, { expiresIn });

    return { access_token, expiresIn };
  }
}
