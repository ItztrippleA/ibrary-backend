import { Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators';
import { PaymentsService } from './payments.service';

type RawRequest = Request & { rawBody?: Buffer };

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('paystack/webhook')
  @ApiOperation({
    summary: 'Paystack webhook',
    description:
      'Paystack calls this with the raw JSON body and an x-paystack-signature header (HMAC SHA512 of the body using the secret key). charge.success activates the subscription and emails a receipt through Resend. Duplicate events are ignored.',
  })
  webhook(
    @Req() req: RawRequest,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }

  @Public()
  @Get('paystack/callback')
  @ApiOperation({
    summary: 'Browser return URL after Paystack checkout',
    description: 'Paystack redirects here with ?reference=. The API verifies the charge and returns the payment.',
  })
  callback(@Query('reference') reference?: string) {
    return this.payments.verify(reference ?? '');
  }

  @Get('verify/:reference')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify a Paystack reference',
    description:
      'Asks Paystack for the charge status. A successful charge activates the subscription, the same way the webhook does.',
  })
  verify(@Param('reference') reference: string) {
    return this.payments.verify(reference);
  }
}
