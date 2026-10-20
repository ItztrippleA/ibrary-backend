import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { BillingService } from './billing.service';
import { PlanCodeDto } from './dto/plan.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({
    summary: 'Subscription plans and the price this student would pay',
    description:
      'Monthly, yearly (5% off), and the 6-month plan at ₦6,000. A referral code takes a further 10% off the first membership. Prices are in kobo for Paystack and also formatted in naira.',
  })
  plans(@CurrentUser() user: User) {
    return this.billing.plans(user.id);
  }

  @Get('subscription')
  @ApiOperation({
    summary: 'Current subscription',
    description: 'Profile tab. An ended period is marked expired.',
  })
  subscription(@CurrentUser() user: User) {
    return this.billing.current(user.id);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Successful payment receipts' })
  receipts(@CurrentUser() user: User) {
    return this.billing.receipts(user.id);
  }

  @Post('subscribe')
  @ApiOperation({
    summary: 'Start a Paystack checkout for a plan',
    description:
      'Creates a pending subscription and returns Paystack\'s authorization URL. The subscription becomes active when the webhook or verify call confirms the charge.',
  })
  subscribe(@CurrentUser() user: User, @Body() dto: PlanCodeDto) {
    return this.billing.subscribe(user, dto.planCode);
  }

  @Post('switch')
  @ApiOperation({
    summary: 'Switch to another plan',
    description: 'Starts a new Paystack charge. The previous active plan is cancelled after payment succeeds.',
  })
  switchPlan(@CurrentUser() user: User, @Body() dto: PlanCodeDto) {
    return this.billing.switchPlan(user, dto.planCode);
  }

  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel membership',
    description: 'Premium access ends immediately. The student can subscribe again later.',
  })
  cancel(@CurrentUser() user: User) {
    return this.billing.cancel(user.id);
  }
}
