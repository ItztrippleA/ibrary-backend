import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'joel@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Kennet1!',
    description:
      'At least 8 characters, with 1 upper case, 1 lower case, and 1 special character.',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Joel' })
  @IsString()
  @Length(1, 60)
  firstName: string;

  @ApiProperty({ example: 'Adeyemi' })
  @IsString()
  @Length(1, 60)
  lastName: string;

  @ApiProperty({
    example: true,
    description: 'Student must accept iBrary terms before the account is created.',
  })
  @IsBoolean()
  acceptTerms: boolean;

  @ApiPropertyOptional({
    example: 'UJVHS65',
    description: 'Optional referral code. Wrong codes are rejected.',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'joel@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Kennet1!' })
  @IsString()
  password: string;
}

export class GoogleAuthDto {
  @ApiProperty({
    description:
      'Google ID token from the web or mobile Google sign-in button. Verified against GOOGLE_CLIENT_ID.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IiJ9...',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ example: 'UJVHS65' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'joel@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the Resend password email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'Nexpass1!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the Resend welcome email' })
  @IsString()
  token: string;
}

export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';
}
