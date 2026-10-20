import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ValidateReferralDto } from './dto/validate-referral.dto';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Your iBrary referral code',
    description:
      'Share text offers 10% off a friend\'s first membership. The design copy uses a code such as UJVHS65.',
  })
  async me(@CurrentUser() user: User) {
    const invited = await this.prisma.referralRedemption.count({
      where: { referrerId: user.id },
    });
    return {
      code: user.referralCode,
      discountPercent: 10,
      invited,
      shareText: `Join me on iBrary with my referral code ${user.referralCode} and enjoy 10% off your first membership!`,
    };
  }

  @Public()
  @Post('validate')
  @ApiOperation({
    summary: 'Check a referral code before signup',
    description: 'Returns accepted, or 400 Wrong referral code.',
  })
  async validate(@Body() dto: ValidateReferralDto) {
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: dto.code.trim().toUpperCase() },
      select: { firstName: true },
    });
    if (!referrer) {
      throw new BadRequestException('Wrong referral code');
    }
    return {
      valid: true,
      message: 'Referral code accepted',
      discountPercent: 10,
      referrerFirstName: referrer.firstName,
    };
  }
}
