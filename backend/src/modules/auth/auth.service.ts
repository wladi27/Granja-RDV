import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DomainService } from '../../common/domain.service';
import { AuthenticatedUser } from '../../common/auth.types';
import { UserRole } from '../../domain/models';

@Injectable()
export class AuthService {
  constructor(
    private readonly domainService: DomainService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    sponsorCode?: string;
    role?: UserRole;
  }) {
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Password must have at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(
      input.password,
      this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS'),
    );

    const user = await this.domainService.registerUser({
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      sponsorCode: input.sponsorCode,
      passwordHash,
      role: input.role ?? 'customer',
    });

    return {
      user,
      tokens: this.signTokens({
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
      }),
    };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.domainService.getUserAuthByEmail(input.email);

    const passwordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions: this.normalizePermissions(user.permissions),
    };

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        whatsappPhone: user.whatsapp_phone,
        role: user.role,
        referralCode: user.referral_code,
        permissions: this.normalizePermissions(user.permissions),
      },
      tokens: this.signTokens(payload),
    };
  }

  async refresh(input: { refreshToken: string }) {
    if (!input.refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(input.refreshToken, refreshSecret);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const subject = typeof decoded === 'string' ? undefined : decoded.sub;
    if (!subject || typeof subject !== 'string') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    let user: Awaited<ReturnType<DomainService['getUserAuthById']>>;
    try {
      user = await this.domainService.getUserAuthById(subject);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions: this.normalizePermissions(user.permissions),
    };

    return {
      tokens: this.signTokens(payload),
    };
  }

  me(user: AuthenticatedUser) {
    return {
      id: user.sub,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    };
  }

  private normalizePermissions(value: unknown): AuthenticatedUser['permissions'] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is AuthenticatedUser['permissions'][number] => typeof item === 'string');
    }

    if (typeof value === 'string') {
      try {
        return this.normalizePermissions(JSON.parse(value) as unknown);
      } catch {
        return [];
      }
    }

    return [];
  }

  private signTokens(payload: AuthenticatedUser) {
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshExpiresIn = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');
    const accessOptions: jwt.SignOptions = {
      expiresIn: accessExpiresIn as jwt.SignOptions['expiresIn'],
    };
    const refreshOptions: jwt.SignOptions = {
      expiresIn: refreshExpiresIn as jwt.SignOptions['expiresIn'],
    };

    return {
      accessToken: jwt.sign(payload as jwt.JwtPayload, accessSecret, accessOptions),
      refreshToken: jwt.sign(payload as jwt.JwtPayload, refreshSecret, refreshOptions),
    };
  }
}
