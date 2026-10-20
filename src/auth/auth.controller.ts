import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import {
  AuthTokensDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Create an iBrary account',
    description:
      'Email and password signup from the Create Your Account screen. Optional referral code. Sends a Resend welcome email with a verification link.',
  })
  @ApiCreatedResponse({ type: AuthTokensDto })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthTokensDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('google')
  @ApiOperation({
    summary: 'Sign in with Google',
    description:
      'Replaces Facebook. The client obtains a Google ID token and posts it here. New students are created; an existing email is linked to the Google account.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  google(@Body() dto: GoogleAuthDto) {
    return this.auth.google(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate the refresh token',
    description: 'Returns a new access token and refresh token. The previous refresh token is revoked.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Email a password reset token',
    description: 'Always returns success so the endpoint does not reveal which emails are registered. Delivery uses Resend.',
  })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password with the emailed token' })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Confirm an email address with the token from Resend' })
  verify(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({
    summary: 'Confirm an email address from the link in the welcome email',
  })
  verifyFromLink(@Query('token') token: string) {
    return this.auth.verifyEmail(token ?? '');
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current student, from the access token' })
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      classLevel: user.classLevel,
      classPath: user.classPath,
      points: user.points,
      role: user.role,
      referralCode: user.referralCode,
      emailVerifiedAt: user.emailVerifiedAt,
      hasPassword: Boolean(user.passwordHash),
      googleLinked: Boolean(user.googleId),
    };
  }
}
