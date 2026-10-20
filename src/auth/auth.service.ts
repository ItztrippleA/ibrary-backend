import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationType, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { addDuration, randomToken, referralCode, sha256 } from '../common/crypto';
import { readEnv } from '../config/env';
import { resetEmail, welcomeEmail } from '../notifications/email.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GoogleAuthDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { passwordIssues } from './password.policy';

const REFERRAL_DISCOUNT = 10;

@Injectable()
export class AuthService {
  private readonly env = readEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptTerms) {
      throw new BadRequestException('Accept the iBrary terms to create an account');
    }
    const issues = passwordIssues(dto.password);
    if (issues.length) {
      throw new BadRequestException({
        message: 'Password does not meet the rules',
        missing: issues,
      });
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const referrer = dto.referralCode
      ? await this.findReferrer(dto.referralCode)
      : null;

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        termsAcceptedAt: new Date(),
        referralCode: await this.uniqueReferralCode(),
        referredById: referrer?.id,
      },
    });

    if (referrer) {
      await this.prisma.referralRedemption.create({
        data: {
          code: referrer.referralCode,
          referrerId: referrer.id,
          refereeId: user.id,
          discountPercent: REFERRAL_DISCOUNT,
        },
      });
    }

    const verify = await this.storeEmailVerification(user.id);
    const link = `${this.env.appUrl}/api/v1/auth/verify-email?token=${verify}`;
    const mail = welcomeEmail(user.firstName, link);
    await this.notifications.notify({
      user,
      type: NotificationType.WELCOME,
      title: 'Welcome to iBrary',
      body: 'Confirm your email to finish creating your account.',
      email: { subject: mail.subject, html: mail.html },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        user?.googleId
          ? 'This account uses Google sign-in'
          : 'Email or password is incorrect',
      );
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return this.issueTokens(user);
  }

  async google(dto: GoogleAuthDto) {
    if (!this.env.googleClientId) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID.',
      );
    }
    const client = new OAuth2Client(this.env.googleClientId);
    let payload: { sub?: string; email?: string; given_name?: string; family_name?: string; picture?: string; email_verified?: boolean } | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken: dto.idToken,
        audience: this.env.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google token could not be verified');
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google token is missing an email');
    }

    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email }] },
    });

    if (!user) {
      const referrer = dto.referralCode
        ? await this.findReferrer(dto.referralCode)
        : null;
      user = await this.prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          firstName: payload.given_name ?? 'Student',
          lastName: payload.family_name ?? '',
          avatarUrl: payload.picture,
          emailVerifiedAt: payload.email_verified ? new Date() : null,
          termsAcceptedAt: new Date(),
          referralCode: await this.uniqueReferralCode(),
          referredById: referrer?.id,
        },
      });
      if (referrer) {
        await this.prisma.referralRedemption.create({
          data: {
            code: referrer.referralCode,
            referrerId: referrer.id,
            refereeId: user.id,
            discountPercent: REFERRAL_DISCOUNT,
          },
        });
      }
      await this.notifications.notify({
        user,
        type: NotificationType.WELCOME,
        title: 'Welcome to iBrary',
        body: 'Your Google account is ready. Choose your class to get started.',
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          avatarUrl: user.avatarUrl ?? payload.picture,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      const token = randomToken();
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: addDuration(new Date(), '1h'),
        },
      });
      const mail = resetEmail(user.firstName, token);
      await this.notifications.notify({
        user,
        type: NotificationType.PASSWORD_RESET,
        title: 'Password reset',
        body: 'A reset token was sent to your email.',
        email: { subject: mail.subject, html: mail.html },
      });
    }
    return {
      ok: true,
      message: 'If that email has an account, a reset message is on the way.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const issues = passwordIssues(dto.password);
    if (issues.length) {
      throw new BadRequestException({
        message: 'Password does not meet the rules',
        missing: issues,
      });
    }
    const stored = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Reset token is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await bcrypt.hash(dto.password, 10) },
      }),
      this.prisma.passwordReset.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const stored = await this.prisma.emailVerification.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Verification token is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerification.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.env.jwtAccessSecret,
        expiresIn: this.env.jwtAccessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    const refreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: addDuration(new Date(), this.env.jwtRefreshTtl),
      },
    });
    return { accessToken, refreshToken, tokenType: 'Bearer' as const };
  }

  private async findReferrer(code: string) {
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code.trim().toUpperCase() },
    });
    if (!referrer) {
      throw new BadRequestException('Wrong referral code');
    }
    return referrer;
  }

  private async uniqueReferralCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = referralCode();
      const taken = await this.prisma.user.findUnique({
        where: { referralCode: code },
      });
      if (!taken) return code;
    }
    throw new ConflictException('Could not allocate a referral code');
  }

  private async storeEmailVerification(userId: string) {
    const token = randomToken();
    await this.prisma.emailVerification.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: addDuration(new Date(), '1d'),
      },
    });
    return token;
  }
}
