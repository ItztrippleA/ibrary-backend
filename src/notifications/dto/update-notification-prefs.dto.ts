import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Resend emails for assessment results',
  })
  @IsOptional()
  @IsBoolean()
  assessmentEmails?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Resend emails for receipts and subscription changes',
  })
  @IsOptional()
  @IsBoolean()
  billingEmails?: boolean;
}
